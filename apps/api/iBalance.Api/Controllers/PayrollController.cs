using iBalance.Api.Security;
using iBalance.Api.Services.Audit;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Finance.Domain.Entities;
using iBalance.Modules.Finance.Domain.Enums;
using iBalance.Modules.Platform.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/payroll")]
public sealed class PayrollController : ControllerBase
{
    private sealed record PayrollScopeContext(bool IsUnrestricted, IReadOnlyCollection<string> DepartmentTokens);

    private static bool IsCurrentUserPlatformAdmin(ClaimsPrincipal user)
    {
        return user.IsInRole("PlatformAdmin");
    }

    private static bool IsCurrentUserTenantAdmin(ClaimsPrincipal user)
    {
        return user.IsInRole("TenantAdmin");
    }

    private static string NormalizeScopeText(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim().ToLowerInvariant();
    }

    private static Guid? GetCurrentUserId(ClaimsPrincipal user)
    {
        var value = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(value, out var userId) ? userId : null;
    }

    private async Task<PayrollScopeContext> GetPayrollScopeContextAsync(
        ApplicationDbContext dbContext,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        if (IsCurrentUserPlatformAdmin(User) || IsCurrentUserTenantAdmin(User))
        {
            return new PayrollScopeContext(true, Array.Empty<string>());
        }

        var userId = GetCurrentUserId(User);
        if (!userId.HasValue)
        {
            return new PayrollScopeContext(false, Array.Empty<string>());
        }

        var departmentTokens = await dbContext.Set<UserScopeAssignment>()
            .AsNoTracking()
            .Where(x =>
                x.TenantId == tenantId &&
                x.UserAccountId == userId.Value &&
                x.ScopeType.ToLower() == "department")
            .Select(x => new
            {
                x.ScopeCode,
                x.ScopeName
            })
            .ToListAsync(cancellationToken);

        var tokens = departmentTokens
            .SelectMany(x => new[] { x.ScopeCode, x.ScopeName })
            .Select(NormalizeScopeText)
            .Where(x => x.Length > 0)
            .Distinct()
            .ToList();

        return new PayrollScopeContext(false, tokens);
    }

    private static IQueryable<PayrollEmployee> ApplyEmployeePayrollScope(
        IQueryable<PayrollEmployee> query,
        PayrollScopeContext scope)
    {
        if (scope.IsUnrestricted)
        {
            return query;
        }

        if (scope.DepartmentTokens.Count == 0)
        {
            return query.Where(x => false);
        }

        return query.Where(x =>
            x.Department != null &&
            scope.DepartmentTokens.Contains(x.Department.Trim().ToLower()));
    }

    private static bool IsEmployeeDepartmentAllowed(string? department, PayrollScopeContext scope)
    {
        if (scope.IsUnrestricted)
        {
            return true;
        }

        var normalized = NormalizeScopeText(department);
        return normalized.Length > 0 && scope.DepartmentTokens.Contains(normalized);
    }

[Authorize(Policy = AuthorizationPolicies.PayrollView)]
[HttpGet("employees")]
public async Task<IActionResult> GetEmployees(
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
    CancellationToken cancellationToken)
{
    var tenantContext = tenantContextAccessor.Current;

    if (!tenantContext.IsAvailable)
    {
        return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
    }

    var scope = await GetPayrollScopeContextAsync(dbContext, tenantContext.TenantId, cancellationToken);

    var query = ApplyEmployeePayrollScope(
        dbContext.PayrollEmployees.AsNoTracking(),
        scope);

    var items = await query
        .OrderBy(x => x.EmployeeNumber)
        .Select(x => new
        {
            x.Id,
            x.TenantId,
            x.EmployeeNumber,
            x.FirstName,
            x.MiddleName,
            x.LastName,
            FullName = string.Join(" ", new[] { x.FirstName, x.MiddleName, x.LastName }.Where(v => !string.IsNullOrWhiteSpace(v))),
            DisplayName = string.Join(" ", new[] { x.FirstName, x.MiddleName, x.LastName }.Where(v => !string.IsNullOrWhiteSpace(v))),
            x.Email,
            x.PhoneNumber,
            x.Department,
            x.JobTitle,
            x.HireDateUtc,
            x.BankName,
            x.BankAccountNumber,
            x.PensionNumber,
            x.TaxIdentificationNumber,
            x.IsActive,
            x.Notes,
            x.CreatedOnUtc
        })
        .ToListAsync(cancellationToken);

    return Ok(new
    {
        TenantContextAvailable = tenantContext.IsAvailable,
        TenantId = tenantContext.TenantId,
        TenantKey = tenantContext.TenantKey,
        ScopeApplied = !scope.IsUnrestricted,
        ScopeDepartments = scope.DepartmentTokens,
        Count = items.Count,
        Items = items
    });
}

[Authorize(Policy = AuthorizationPolicies.PayrollManage)]
[HttpPost("employees")]
public async Task<IActionResult> CreateEmployee(
    [FromBody] CreatePayrollEmployeeRequest request,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
    [FromServices] IAuditTrailWriter auditTrailWriter,
    CancellationToken cancellationToken)
{
    var tenantContext = tenantContextAccessor.Current;

    if (!tenantContext.IsAvailable)
    {
        return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
    }

    var validation = ValidateEmployeeRequest(request);
    if (validation is not null)
    {
        return BadRequest(new { Message = validation });
    }

    var payrollScope = await GetPayrollScopeContextAsync(dbContext, tenantContext.TenantId, cancellationToken);

    if (!IsEmployeeDepartmentAllowed(request.Department, payrollScope))
    {
        return Forbid();
    }

    var employeeNumber = request.EmployeeNumber.Trim().ToUpperInvariant();

    var exists = await dbContext.PayrollEmployees
        .AsNoTracking()
        .AnyAsync(x => x.EmployeeNumber == employeeNumber, cancellationToken);

    if (exists)
    {
        return Conflict(new { Message = "An employee with the same employee number already exists.", EmployeeNumber = employeeNumber });
    }

    var employee = new PayrollEmployee(
        Guid.NewGuid(),
        tenantContext.TenantId,
        employeeNumber,
        request.FirstName,
        request.MiddleName,
        request.LastName,
        request.Email,
        request.PhoneNumber,
        request.Department,
        request.JobTitle,
        request.HireDateUtc,
        request.BankName,
        request.BankAccountNumber,
        request.PensionNumber,
        request.TaxIdentificationNumber,
        request.IsActive,
        request.Notes);

    dbContext.PayrollEmployees.Add(employee);
    await dbContext.SaveChangesAsync(cancellationToken);

    await auditTrailWriter.WriteAsync(
        "payroll",
        "PayrollEmployee",
        "Created",
        employee.Id,
        employee.EmployeeNumber,
        $"Payroll employee '{employee.EmployeeNumber}' created.",
        User.Identity?.Name,
        tenantContext.TenantId,
        new { employee.EmployeeNumber, employee.FullName, employee.Department, employee.IsActive },
        cancellationToken);

    return Ok(new { Message = "Payroll employee created successfully.", employee.Id, employee.EmployeeNumber, employee.FullName });
}

[Authorize(Policy = AuthorizationPolicies.PayrollManage)]
[HttpPut("employees/{employeeId:guid}")]
public async Task<IActionResult> UpdateEmployee(
    [FromRoute] Guid employeeId,
    [FromBody] UpdatePayrollEmployeeRequest request,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
    [FromServices] IAuditTrailWriter auditTrailWriter,
    CancellationToken cancellationToken)
{
    var tenantContext = tenantContextAccessor.Current;

    if (!tenantContext.IsAvailable)
    {
        return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
    }

    var validation = ValidateEmployeeUpdateRequest(request);
    if (validation is not null)
    {
        return BadRequest(new { Message = validation });
    }

    var employee = await dbContext.PayrollEmployees
        .FirstOrDefaultAsync(x => x.Id == employeeId && x.TenantId == tenantContext.TenantId, cancellationToken);

    if (employee is null)
    {
        return NotFound(new { Message = "Payroll employee was not found.", EmployeeId = employeeId });
    }

    var payrollScope = await GetPayrollScopeContextAsync(dbContext, tenantContext.TenantId, cancellationToken);

    if (!IsEmployeeDepartmentAllowed(employee.Department, payrollScope))
    {
        return Forbid();
    }

    if (!IsEmployeeDepartmentAllowed(request.Department, payrollScope))
    {
        return Forbid();
    }

    employee.Update(
        request.FirstName,
        request.MiddleName,
        request.LastName,
        request.Email,
        request.PhoneNumber,
        request.Department,
        request.JobTitle,
        request.HireDateUtc,
        request.BankName,
        request.BankAccountNumber,
        request.PensionNumber,
        request.TaxIdentificationNumber,
        request.IsActive,
        request.Notes);

    await dbContext.SaveChangesAsync(cancellationToken);

    await auditTrailWriter.WriteAsync(
        "payroll",
        "PayrollEmployee",
        "Updated",
        employee.Id,
        employee.EmployeeNumber,
        $"Payroll employee '{employee.EmployeeNumber}' updated.",
        User.Identity?.Name,
        tenantContext.TenantId,
        new { employee.EmployeeNumber, employee.FullName, employee.Department, employee.IsActive },
        cancellationToken);

    return Ok(new
    {
        Message = "Payroll employee updated successfully.",
        employee.Id,
        employee.EmployeeNumber,
        employee.FullName,
        employee.IsActive
    });
}

[Authorize(Policy = AuthorizationPolicies.PayrollManage)]
[HttpDelete("employees/{employeeId:guid}")]
public async Task<IActionResult> DeleteEmployee(
    [FromRoute] Guid employeeId,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
    [FromServices] IAuditTrailWriter auditTrailWriter,
    CancellationToken cancellationToken)
{
    var tenantContext = tenantContextAccessor.Current;

    if (!tenantContext.IsAvailable)
    {
        return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
    }

    var employee = await dbContext.PayrollEmployees
        .FirstOrDefaultAsync(x => x.Id == employeeId && x.TenantId == tenantContext.TenantId, cancellationToken);

    if (employee is null)
    {
        return NotFound(new { Message = "Payroll employee was not found.", EmployeeId = employeeId });
    }

    var payrollScope = await GetPayrollScopeContextAsync(dbContext, tenantContext.TenantId, cancellationToken);

    if (!IsEmployeeDepartmentAllowed(employee.Department, payrollScope))
    {
        return Forbid();
    }

    var hasSalaryStructure = await dbContext.PayrollSalaryStructures
        .AsNoTracking()
        .AnyAsync(x => x.EmployeeId == employeeId && x.TenantId == tenantContext.TenantId, cancellationToken);

    var hasRunHistory = await dbContext.PayrollRunLines
        .AsNoTracking()
        .AnyAsync(x => x.EmployeeId == employeeId && x.TenantId == tenantContext.TenantId, cancellationToken);

    if (hasSalaryStructure || hasRunHistory)
    {
        return Conflict(new
        {
            Message = "Cannot delete employee because the employee is already referenced by salary structures or payroll history.",
            EmployeeId = employeeId,
            employee.EmployeeNumber,
            employee.FullName
        });
    }

    dbContext.PayrollEmployees.Remove(employee);
    await dbContext.SaveChangesAsync(cancellationToken);

    await auditTrailWriter.WriteAsync(
        "payroll",
        "PayrollEmployee",
        "Deleted",
        employee.Id,
        employee.EmployeeNumber,
        $"Payroll employee '{employee.EmployeeNumber}' deleted.",
        User.Identity?.Name,
        tenantContext.TenantId,
        new { employee.EmployeeNumber, employee.FullName },
        cancellationToken);

    return Ok(new
    {
        Message = "Payroll employee deleted successfully.",
        employee.Id,
        employee.EmployeeNumber,
        employee.FullName
    });
}

[Authorize(Policy = AuthorizationPolicies.PayrollManage)]
[HttpPost("employees/import")]
public async Task<IActionResult> ImportEmployees(
    [FromBody] ImportPayrollEmployeesRequest request,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
    [FromServices] IAuditTrailWriter auditTrailWriter,
    CancellationToken cancellationToken)
{
    var tenantContext = tenantContextAccessor.Current;

    if (!tenantContext.IsAvailable)
    {
        return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
    }

    if (request.Items is null || request.Items.Count == 0)
    {
        return BadRequest(new { Message = "At least one employee row is required." });
    }
    var payrollScope = await GetPayrollScopeContextAsync(dbContext, tenantContext.TenantId, cancellationToken);

    var imported = new List<PayrollEmployee>();
    var errors = new List<object>();
    var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    foreach (var row in request.Items.Select((value, index) => new { value, index }))
    {
        var item = row.value;
        var rowNumber = row.index + 1;
        var validation = ValidateEmployeeRequest(item);

        if (validation is not null)
        {
            errors.Add(new { Row = rowNumber, Message = validation });
            continue;
        }

        if (!IsEmployeeDepartmentAllowed(item.Department, payrollScope))
        {
            errors.Add(new
            {
                Row = rowNumber,
                Message = "You are not allowed to import an employee into this department.",
                Department = item.Department
            });
            continue;
        }

        var employeeNumber = item.EmployeeNumber.Trim().ToUpperInvariant();

        if (!seen.Add(employeeNumber))
        {
            errors.Add(new { Row = rowNumber, Message = "Duplicate employee number inside upload file.", EmployeeNumber = employeeNumber });
            continue;
        }

        var exists = await dbContext.PayrollEmployees
            .AsNoTracking()
            .AnyAsync(x => x.EmployeeNumber == employeeNumber, cancellationToken);

        if (exists)
        {
            errors.Add(new { Row = rowNumber, Message = "Employee number already exists.", EmployeeNumber = employeeNumber });
            continue;
        }

        imported.Add(new PayrollEmployee(
            Guid.NewGuid(),
            tenantContext.TenantId,
            employeeNumber,
            item.FirstName,
            item.MiddleName,
            item.LastName,
            item.Email,
            item.PhoneNumber,
            item.Department,
            item.JobTitle,
            item.HireDateUtc,
            item.BankName,
            item.BankAccountNumber,
            item.PensionNumber,
            item.TaxIdentificationNumber,
            item.IsActive,
            item.Notes));
    }

    if (errors.Count > 0)
    {
        return BadRequest(new
        {
            Message = "Employee import failed validation.",
            ErrorCount = errors.Count,
            Errors = errors
        });
    }

    dbContext.PayrollEmployees.AddRange(imported);
    await dbContext.SaveChangesAsync(cancellationToken);

    await auditTrailWriter.WriteAsync(
        "payroll",
        "PayrollEmployee",
        "Imported",
        null,
        "employee-import",
        $"Imported {imported.Count} payroll employee(s).",
        User.Identity?.Name,
        tenantContext.TenantId,
        new { Count = imported.Count },
        cancellationToken);

    return Ok(new
    {
        Message = "Payroll employees imported successfully.",
        Count = imported.Count,
        Items = imported.Select(x => new { x.Id, x.EmployeeNumber, x.FirstName, x.MiddleName, x.LastName, x.FullName }).ToList()
    });
}



    [Authorize(Policy = AuthorizationPolicies.PayrollView)]
    [HttpGet("pay-groups")]
    public async Task<IActionResult> GetPayGroups(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var items = await dbContext.PayrollPayGroups
            .AsNoTracking()
            .OrderBy(x => x.Code)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.Code,
                x.Name,
                x.Description,
                x.IsActive,
                x.CreatedOnUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpPost("pay-groups")]
    public async Task<IActionResult> CreatePayGroup(
        [FromBody] CreatePayrollPayGroupRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Pay group code and name are required." });
        }

        var code = request.Code.Trim().ToUpperInvariant();
        var exists = await dbContext.PayrollPayGroups.AsNoTracking().AnyAsync(x => x.Code == code, cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A pay group with the same code already exists.", Code = code });
        }

        var payGroup = new PayrollPayGroup(Guid.NewGuid(), tenantContext.TenantId, code, request.Name, request.Description, request.IsActive);
        dbContext.PayrollPayGroups.Add(payGroup);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll",
            "PayrollPayGroup",
            "Created",
            payGroup.Id,
            payGroup.Code,
            $"Payroll pay group '{payGroup.Code}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new { payGroup.Code, payGroup.Name, payGroup.IsActive },
            cancellationToken);

        return Ok(new { Message = "Payroll pay group created successfully.", payGroup.Id, payGroup.Code });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpPut("pay-groups/{payGroupId:guid}")]
    public async Task<IActionResult> UpdatePayGroup(
        [FromRoute] Guid payGroupId,
        [FromBody] UpdatePayrollPayGroupRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Pay group name is required." });
        }

        var payGroup = await dbContext.PayrollPayGroups
            .FirstOrDefaultAsync(x => x.Id == payGroupId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (payGroup is null)
        {
            return NotFound(new { Message = "Payroll pay group was not found.", PayGroupId = payGroupId });
        }

        var normalizedName = request.Name.Trim();
        var normalizedDescription = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();

        dbContext.Entry(payGroup).Property(nameof(PayrollPayGroup.Name)).CurrentValue = normalizedName;
        dbContext.Entry(payGroup).Property(nameof(PayrollPayGroup.Description)).CurrentValue = normalizedDescription;
        dbContext.Entry(payGroup).Property(nameof(PayrollPayGroup.IsActive)).CurrentValue = request.IsActive;

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll",
            "PayrollPayGroup",
            "Updated",
            payGroup.Id,
            payGroup.Code,
            $"Payroll pay group '{payGroup.Code}' updated.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new { payGroup.Code, Name = normalizedName, request.IsActive },
            cancellationToken);

        return Ok(new
        {
            Message = "Payroll pay group updated successfully.",
            payGroup.Id,
            payGroup.Code,
            Name = normalizedName,
            Description = normalizedDescription,
            request.IsActive
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpDelete("pay-groups/{payGroupId:guid}")]
    public async Task<IActionResult> DeletePayGroup(
        [FromRoute] Guid payGroupId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var payGroup = await dbContext.PayrollPayGroups
            .FirstOrDefaultAsync(x => x.Id == payGroupId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (payGroup is null)
        {
            return NotFound(new { Message = "Payroll pay group was not found.", PayGroupId = payGroupId });
        }

        var isReferenced = await dbContext.PayrollSalaryStructures
            .AsNoTracking()
            .AnyAsync(x => x.PayGroupId == payGroupId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (isReferenced)
        {
            return Conflict(new
            {
                Message = "Cannot delete pay group because it is already assigned to one or more salary structures.",
                PayGroupId = payGroupId,
                payGroup.Code,
                payGroup.Name
            });
        }

        dbContext.PayrollPayGroups.Remove(payGroup);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll",
            "PayrollPayGroup",
            "Deleted",
            payGroup.Id,
            payGroup.Code,
            $"Payroll pay group '{payGroup.Code}' deleted.",
            User.Identity?.Name,
            tenantContext.TenantId,
            null,
            cancellationToken);

        return Ok(new
        {
            Message = "Payroll pay group deleted successfully.",
            payGroup.Id,
            payGroup.Code
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollView)]
    [HttpGet("pay-elements")]
    public async Task<IActionResult> GetPayElements(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var items = await dbContext.PayrollPayElements
            .AsNoTracking()
            .Join(
                dbContext.LedgerAccounts.AsNoTracking(),
                element => element.LedgerAccountId,
                account => account.Id,
                (element, account) => new
                {
                    element.Id,
                    element.TenantId,
                    element.Code,
                    element.Name,
                    element.ElementKind,
                    element.CalculationMode,
                    element.DefaultAmount,
                    element.DefaultRate,
                    element.LedgerAccountId,
                    LedgerAccountCode = account.Code,
                    LedgerAccountName = account.Name,
                    element.IsTaxable,
                    element.IsActive,
                    element.Description,
                    element.CreatedOnUtc
                })
            .OrderBy(x => x.Code)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpPost("pay-elements")]
    public async Task<IActionResult> CreatePayElement(
        [FromBody] CreatePayrollPayElementRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Pay element code and name are required." });
        }

        if (request.LedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Ledger account is required for pay element posting setup." });
        }

        var account = await dbContext.LedgerAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.LedgerAccountId, cancellationToken);

        if (account is null || account.IsHeader || !account.IsPostingAllowed || !account.IsActive)
        {
            return BadRequest(new { Message = "Pay element must use an active posting ledger account." });
        }

        var code = request.Code.Trim().ToUpperInvariant();
        var exists = await dbContext.PayrollPayElements.AsNoTracking().AnyAsync(x => x.Code == code, cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A pay element with the same code already exists.", Code = code });
        }

        var element = new PayrollPayElement(
            Guid.NewGuid(),
            tenantContext.TenantId,
            code,
            request.Name,
            request.ElementKind,
            request.CalculationMode,
            request.DefaultAmount,
            request.DefaultRate,
            request.LedgerAccountId,
            request.IsTaxable,
            request.IsActive,
            request.Description);

        dbContext.PayrollPayElements.Add(element);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollPayElement","Created",element.Id,element.Code,$"Payroll pay element '{element.Code}' created.",User.Identity?.Name,tenantContext.TenantId,new { element.Code, element.Name, element.IsActive },cancellationToken);

        return Ok(new { Message = "Payroll pay element created successfully.", element.Id, element.Code });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpPut("pay-elements/{payElementId:guid}")]
    public async Task<IActionResult> UpdatePayElement(
        [FromRoute] Guid payElementId,
        [FromBody] UpdatePayrollPayElementRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Pay element name is required." });
        }

        if (request.LedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Ledger account is required for pay element posting setup." });
        }

        var payElement = await dbContext.PayrollPayElements
            .FirstOrDefaultAsync(x => x.Id == payElementId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (payElement is null)
        {
            return NotFound(new { Message = "Payroll pay element was not found.", PayElementId = payElementId });
        }

        var account = await dbContext.LedgerAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.LedgerAccountId, cancellationToken);

        if (account is null || account.IsHeader || !account.IsPostingAllowed || !account.IsActive)
        {
            return BadRequest(new { Message = "Pay element must use an active posting ledger account." });
        }

        var normalizedName = request.Name.Trim();
        var normalizedDescription = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();

        dbContext.Entry(payElement).Property(nameof(PayrollPayElement.Name)).CurrentValue = normalizedName;
        dbContext.Entry(payElement).Property(nameof(PayrollPayElement.ElementKind)).CurrentValue = request.ElementKind;
        dbContext.Entry(payElement).Property(nameof(PayrollPayElement.CalculationMode)).CurrentValue = request.CalculationMode;
        dbContext.Entry(payElement).Property(nameof(PayrollPayElement.DefaultAmount)).CurrentValue = request.DefaultAmount;
        dbContext.Entry(payElement).Property(nameof(PayrollPayElement.DefaultRate)).CurrentValue = request.DefaultRate;
        dbContext.Entry(payElement).Property(nameof(PayrollPayElement.LedgerAccountId)).CurrentValue = request.LedgerAccountId;
        dbContext.Entry(payElement).Property(nameof(PayrollPayElement.IsTaxable)).CurrentValue = request.IsTaxable;
        dbContext.Entry(payElement).Property(nameof(PayrollPayElement.IsActive)).CurrentValue = request.IsActive;
        dbContext.Entry(payElement).Property(nameof(PayrollPayElement.Description)).CurrentValue = normalizedDescription;

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollPayElement","Updated",payElement.Id,payElement.Code,$"Payroll pay element '{payElement.Code}' updated.",User.Identity?.Name,tenantContext.TenantId,new { payElement.Code, Name = normalizedName, request.IsActive },cancellationToken);

        return Ok(new
        {
            Message = "Payroll pay element updated successfully.",
            payElement.Id,
            payElement.Code,
            Name = normalizedName,
            request.ElementKind,
            request.CalculationMode,
            request.DefaultAmount,
            request.DefaultRate,
            request.LedgerAccountId,
            request.IsTaxable,
            request.IsActive,
            Description = normalizedDescription
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpDelete("pay-elements/{payElementId:guid}")]
    public async Task<IActionResult> DeletePayElement(
        [FromRoute] Guid payElementId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var payElement = await dbContext.PayrollPayElements
            .FirstOrDefaultAsync(x => x.Id == payElementId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (payElement is null)
        {
            return NotFound(new { Message = "Payroll pay element was not found.", PayElementId = payElementId });
        }

        dbContext.PayrollPayElements.Remove(payElement);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollPayElement","Deleted",payElement.Id,payElement.Code,$"Payroll pay element '{payElement.Code}' deleted.",User.Identity?.Name,tenantContext.TenantId,null,cancellationToken);

        return Ok(new
        {
            Message = "Payroll pay element deleted successfully.",
            payElement.Id,
            payElement.Code
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollView)]
    [HttpGet("salary-structures")]
    public async Task<IActionResult> GetSalaryStructures(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var items = await dbContext.PayrollSalaryStructures
            .AsNoTracking()
            .Join(
                dbContext.PayrollEmployees.AsNoTracking(),
                structure => structure.EmployeeId,
                employee => employee.Id,
                (structure, employee) => new { structure, employee })
            .Join(
                dbContext.PayrollPayGroups.AsNoTracking(),
                joined => joined.structure.PayGroupId,
                group => group.Id,
                (joined, group) => new
                {
                    joined.structure.Id,
                    joined.structure.TenantId,
                    joined.structure.EmployeeId,
                    joined.employee.EmployeeNumber,
                    EmployeeName = (joined.employee.FirstName + " " + joined.employee.LastName).Trim(),
                    joined.structure.PayGroupId,
                    PayGroupCode = group.Code,
                    PayGroupName = group.Name,
                    joined.structure.BasicSalary,
                    joined.structure.CurrencyCode,
                    joined.structure.EffectiveFromUtc,
                    joined.structure.IsActive,
                    joined.structure.Notes,
                    joined.structure.CreatedOnUtc
                })
            .OrderBy(x => x.EmployeeNumber)
            .ThenByDescending(x => x.EffectiveFromUtc)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpPost("salary-structures")]
    public async Task<IActionResult> CreateSalaryStructure(
        [FromBody] CreatePayrollSalaryStructureRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (request.EmployeeId == Guid.Empty || request.PayGroupId == Guid.Empty)
        {
            return BadRequest(new { Message = "Employee and pay group are required." });
        }

        if (request.BasicSalary < 0m)
        {
            return BadRequest(new { Message = "Basic salary cannot be negative." });
        }

        var employeeExists = await dbContext.PayrollEmployees.AsNoTracking().AnyAsync(x => x.Id == request.EmployeeId, cancellationToken);
        var payGroupExists = await dbContext.PayrollPayGroups.AsNoTracking().AnyAsync(x => x.Id == request.PayGroupId, cancellationToken);

        if (!employeeExists || !payGroupExists)
        {
            return BadRequest(new { Message = "Employee or pay group was not found." });
        }

        var structure = new PayrollSalaryStructure(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.EmployeeId,
            request.PayGroupId,
            request.BasicSalary,
            string.IsNullOrWhiteSpace(request.CurrencyCode) ? "NGN" : request.CurrencyCode,
            request.EffectiveFromUtc,
            request.IsActive,
            request.Notes);

        dbContext.PayrollSalaryStructures.Add(structure);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollSalaryStructure","Created",structure.Id,structure.Id.ToString(),"Payroll salary structure created successfully.",User.Identity?.Name,tenantContext.TenantId,new { structure.EmployeeId, structure.PayGroupId, structure.BasicSalary, structure.IsActive },cancellationToken);

        return Ok(new { Message = "Payroll salary structure created successfully.", structure.Id });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpPut("salary-structures/{salaryStructureId:guid}")]
    public async Task<IActionResult> UpdateSalaryStructure(
        [FromRoute] Guid salaryStructureId,
        [FromBody] UpdatePayrollSalaryStructureRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (request.EmployeeId == Guid.Empty || request.PayGroupId == Guid.Empty)
        {
            return BadRequest(new { Message = "Employee and pay group are required." });
        }

        if (request.BasicSalary < 0m)
        {
            return BadRequest(new { Message = "Basic salary cannot be negative." });
        }

        var structure = await dbContext.PayrollSalaryStructures
            .FirstOrDefaultAsync(x => x.Id == salaryStructureId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (structure is null)
        {
            return NotFound(new { Message = "Payroll salary structure was not found.", SalaryStructureId = salaryStructureId });
        }

        var employeeExists = await dbContext.PayrollEmployees.AsNoTracking().AnyAsync(x => x.Id == request.EmployeeId, cancellationToken);
        var payGroupExists = await dbContext.PayrollPayGroups.AsNoTracking().AnyAsync(x => x.Id == request.PayGroupId, cancellationToken);

        if (!employeeExists || !payGroupExists)
        {
            return BadRequest(new { Message = "Employee or pay group was not found." });
        }

        var normalizedCurrencyCode = string.IsNullOrWhiteSpace(request.CurrencyCode) ? "NGN" : request.CurrencyCode.Trim().ToUpperInvariant();
        var normalizedNotes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        dbContext.Entry(structure).Property(nameof(PayrollSalaryStructure.EmployeeId)).CurrentValue = request.EmployeeId;
        dbContext.Entry(structure).Property(nameof(PayrollSalaryStructure.PayGroupId)).CurrentValue = request.PayGroupId;
        dbContext.Entry(structure).Property(nameof(PayrollSalaryStructure.BasicSalary)).CurrentValue = request.BasicSalary;
        dbContext.Entry(structure).Property(nameof(PayrollSalaryStructure.CurrencyCode)).CurrentValue = normalizedCurrencyCode;
        dbContext.Entry(structure).Property(nameof(PayrollSalaryStructure.EffectiveFromUtc)).CurrentValue = request.EffectiveFromUtc;
        dbContext.Entry(structure).Property(nameof(PayrollSalaryStructure.IsActive)).CurrentValue = request.IsActive;
        dbContext.Entry(structure).Property(nameof(PayrollSalaryStructure.Notes)).CurrentValue = normalizedNotes;

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollSalaryStructure","Updated",structure.Id,structure.Id.ToString(),"Payroll salary structure updated successfully.",User.Identity?.Name,tenantContext.TenantId,new { request.EmployeeId, request.PayGroupId, request.BasicSalary, request.IsActive },cancellationToken);

        return Ok(new
        {
            Message = "Payroll salary structure updated successfully.",
            structure.Id,
            request.EmployeeId,
            request.PayGroupId,
            request.BasicSalary,
            CurrencyCode = normalizedCurrencyCode,
            request.EffectiveFromUtc,
            request.IsActive,
            Notes = normalizedNotes
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpDelete("salary-structures/{salaryStructureId:guid}")]
    public async Task<IActionResult> DeleteSalaryStructure(
        [FromRoute] Guid salaryStructureId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var structure = await dbContext.PayrollSalaryStructures
            .FirstOrDefaultAsync(x => x.Id == salaryStructureId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (structure is null)
        {
            return NotFound(new { Message = "Payroll salary structure was not found.", SalaryStructureId = salaryStructureId });
        }

        dbContext.PayrollSalaryStructures.Remove(structure);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Payroll salary structure deleted successfully.",
            structure.Id
        });
    }


    [Authorize(Policy = AuthorizationPolicies.PayrollRunPost)]
    [HttpPost("run/{runId:guid}/post")]
    public async Task<IActionResult> PostPayrollRun(
        [FromRoute] Guid runId,
        [FromBody] PostPayrollRunRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (request.SalaryExpenseAccountId == Guid.Empty ||
            request.DeductionsPayableAccountId == Guid.Empty ||
            request.NetSalaryPayableAccountId == Guid.Empty)
        {
            return BadRequest(new
            {
                Message = "Fallback salary expense, fallback deductions payable, and net salary payable accounts are required."
            });
        }

        var run = await dbContext.PayrollRuns
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == runId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (run is null)
        {
            return NotFound(new { Message = "Payroll run was not found.", RunId = runId });
        }

        if (run.Status == 2 || run.JournalEntryId.HasValue)
        {
            return Conflict(new { Message = "Payroll run has already been posted.", RunId = runId, run.JournalEntryId });
        }

        if (run.Status != 1)
        {
            return Conflict(new { Message = "Only approved / submitted payroll runs can be posted.", RunId = runId, run.Status });
        }

        if (run.Lines.Count == 0)
        {
            return BadRequest(new { Message = "Payroll run has no lines to post." });
        }

        var postingDateUtc = request.PostingDateUtc ?? ResolvePayrollRunPostingDateUtc(run.PayrollPeriod);
        var postingDate = DateOnly.FromDateTime(postingDateUtc);

        var fiscalPeriod = await dbContext.FiscalPeriods
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.StartDate <= postingDate &&
                x.EndDate >= postingDate,
                cancellationToken);

        if (fiscalPeriod is null)
        {
            return BadRequest(new
            {
                Message = "No fiscal period exists for the selected payroll posting date.",
                PostingDateUtc = postingDateUtc
            });
        }

        if (fiscalPeriod.Status != FiscalPeriodStatus.Open)
        {
            return BadRequest(new
            {
                Message = "Posting blocked: the fiscal period matching the selected posting date is closed or not open for posting.",
                PostingDateUtc = postingDateUtc,
                FiscalPeriod = fiscalPeriod.Name
            });
        }

        var requestedAccountIds = new[]
        {
            request.SalaryExpenseAccountId,
            request.DeductionsPayableAccountId,
            request.NetSalaryPayableAccountId
        }.Distinct().ToList();

        var payrollItems = await dbContext.Set<PayrollRunLineItem>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId && run.Lines.Select(line => line.Id).Contains(x.PayrollRunLineId))
            .OrderBy(x => x.Sequence)
            .ThenBy(x => x.Code)
            .ToListAsync(cancellationToken);

        if (payrollItems.Count == 0)
        {
            return BadRequest(new { Message = "Payroll run line items were not found for posting." });
        }

        var payElementIds = payrollItems
            .Where(x => x.PayElementId.HasValue)
            .Select(x => x.PayElementId!.Value)
            .Distinct()
            .ToList();

        var payElements = await dbContext.PayrollPayElements
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId && payElementIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        requestedAccountIds.AddRange(payElements.Values.Select(x => x.LedgerAccountId));
        requestedAccountIds = requestedAccountIds.Distinct().ToList();

        var accounts = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => requestedAccountIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        foreach (var ledgerAccountId in requestedAccountIds)
        {
            if (!accounts.TryGetValue(ledgerAccountId, out var account))
            {
                return BadRequest(new { Message = "One or more payroll posting accounts were not found.", LedgerAccountId = ledgerAccountId });
            }

            if (!account.IsActive || account.IsHeader || !account.IsPostingAllowed)
            {
                return BadRequest(new
                {
                    Message = "Payroll posting accounts must be active, non-header, posting-enabled ledger accounts.",
                    account.Id,
                    account.Code,
                    account.Name
                });
            }
        }

        var lineBuilders = new List<(Guid LedgerAccountId, string Description, decimal DebitAmount, decimal CreditAmount)>();

        foreach (var item in payrollItems)
        {
            PayrollPayElement? mappedPayElement = null;

            if (item.PayElementId.HasValue)
            {
                payElements.TryGetValue(item.PayElementId.Value, out mappedPayElement);
            }

            var hasMappedPayElement = mappedPayElement is not null;

            if (item.ElementKind == 1)
            {
                var ledgerAccountId = hasMappedPayElement ? mappedPayElement!.LedgerAccountId : request.SalaryExpenseAccountId;
                lineBuilders.Add((
                    ledgerAccountId,
                    hasMappedPayElement
                        ? $"Payroll earning - {item.Code} - {run.PayrollPeriod}"
                        : $"Payroll earning fallback - {item.Code} - {run.PayrollPeriod}",
                    item.Amount,
                    0m));
                continue;
            }

            if (item.ElementKind == 2)
            {
                var ledgerAccountId = hasMappedPayElement ? mappedPayElement!.LedgerAccountId : request.DeductionsPayableAccountId;
                lineBuilders.Add((
                    ledgerAccountId,
                    hasMappedPayElement
                        ? $"Payroll deduction - {item.Code} - {run.PayrollPeriod}"
                        : $"Payroll deduction fallback - {item.Code} - {run.PayrollPeriod}",
                    0m,
                    item.Amount));
                continue;
            }

            if (item.ElementKind == 3)
            {
                var expenseLedgerAccountId = hasMappedPayElement ? mappedPayElement!.LedgerAccountId : request.SalaryExpenseAccountId;

                lineBuilders.Add((
                    expenseLedgerAccountId,
                    hasMappedPayElement
                        ? $"Employer payroll cost - {item.Code} - {run.PayrollPeriod}"
                        : $"Employer payroll cost fallback - {item.Code} - {run.PayrollPeriod}",
                    item.Amount,
                    0m));

                lineBuilders.Add((
                    request.DeductionsPayableAccountId,
                    $"Employer payroll obligation payable - {item.Code} - {run.PayrollPeriod}",
                    0m,
                    item.Amount));
            }
        }

        var totalNetPay = run.Lines.Sum(x => x.NetPay);
        if (totalNetPay > 0m)
        {
            lineBuilders.Add((
                request.NetSalaryPayableAccountId,
                $"Net salary payable - {run.PayrollPeriod}",
                0m,
                totalNetPay));
        }

        var groupedLines = lineBuilders
            .GroupBy(x => new { x.LedgerAccountId, x.Description })
            .Select(group => new JournalEntryLine(
                Guid.NewGuid(),
                group.Key.LedgerAccountId,
                group.Key.Description,
                group.Sum(x => x.DebitAmount),
                group.Sum(x => x.CreditAmount)))
            .Where(x => x.DebitAmount != 0m || x.CreditAmount != 0m)
            .ToList();

        var totalDebit = groupedLines.Sum(x => x.DebitAmount);
        var totalCredit = groupedLines.Sum(x => x.CreditAmount);

        if (groupedLines.Count == 0)
        {
            return BadRequest(new { Message = "No payroll journal lines were generated for posting." });
        }

        if (totalDebit != totalCredit)
        {
            return BadRequest(new
            {
                Message = "Payroll posting is out of balance. Review pay-element ledger mappings and payroll line items.",
                TotalDebit = totalDebit,
                TotalCredit = totalCredit
            });
        }

        var reference = string.IsNullOrWhiteSpace(request.Reference)
            ? $"PAY-{run.PayrollPeriod}".Trim().ToUpperInvariant()
            : request.Reference.Trim().ToUpperInvariant();

        var referenceExists = await dbContext.JournalEntries
            .AsNoTracking()
            .AnyAsync(x => x.Reference == reference, cancellationToken);

        if (referenceExists)
        {
            return Conflict(new { Message = "A journal entry with the same reference already exists.", Reference = reference });
        }

        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            postingDateUtc,
            reference,
            string.IsNullOrWhiteSpace(request.Description) ? $"Payroll posting - {run.PayrollPeriod}" : request.Description.Trim(),
            JournalEntryStatus.Approved,
            JournalEntryType.Normal,
            groupedLines);

        var postedAtUtc = DateTime.UtcNow;
        journalEntry.MarkPosted(postedAtUtc);

        var movements = journalEntry.Lines
            .Select(line => new LedgerMovement(
                Guid.NewGuid(),
                tenantContext.TenantId,
                journalEntry.Id,
                line.Id,
                line.LedgerAccountId,
                journalEntry.EntryDateUtc,
                journalEntry.Reference,
                line.Description,
                line.DebitAmount,
                line.CreditAmount))
            .ToList();

        run.MarkPosted(journalEntry.Id);

        dbContext.JournalEntries.Add(journalEntry);
        dbContext.LedgerMovements.AddRange(movements);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Payroll posted successfully.",
            PostingDateUtc = postingDateUtc,
            FiscalPeriod = fiscalPeriod.Name,
            PayrollRun = new
            {
                run.Id,
                run.PayrollPeriod,
                run.Status,
                run.JournalEntryId,
                run.PostedOnUtc,
                EmployeeCount = run.Lines.Count,
                TotalNetPay = totalNetPay
            },
            JournalEntry = new
            {
                journalEntry.Id,
                journalEntry.Reference,
                journalEntry.Description,
                journalEntry.Status,
                journalEntry.Type,
                journalEntry.PostedAtUtc,
                journalEntry.TotalDebit,
                journalEntry.TotalCredit
            }
        });
    }




    [Authorize(Policy = AuthorizationPolicies.PayrollRunSubmit)]
    [HttpPost("run/{runId:guid}/submit")]
    public async Task<IActionResult> SubmitPayrollRun(
        [FromRoute] Guid runId,
        [FromBody] SubmitPayrollRunRequest? request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var run = await dbContext.PayrollRuns
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == runId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (run is null)
        {
            return NotFound(new { Message = "Payroll run was not found.", RunId = runId });
        }

        if (run.Status != 0)
        {
            return Conflict(new { Message = "Only draft payroll runs can be submitted.", RunId = runId, run.Status });
        }

        if (run.Lines.Count == 0)
        {
            return BadRequest(new { Message = "Payroll run has no lines to submit.", RunId = runId });
        }

        run.MarkProcessed();
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollRun","Submitted",run.Id,run.PayrollPeriod,$"Payroll run '{run.PayrollPeriod}' submitted.",User.Identity?.Name,tenantContext.TenantId,new { run.PayrollPeriod, run.Status },cancellationToken);

        return Ok(new
        {
            Message = "Payroll run submitted successfully.",
            run.Id,
            run.PayrollPeriod,
            run.Status,
            Notes = string.IsNullOrWhiteSpace(request?.Notes) ? null : request!.Notes!.Trim()
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollRunApprove)]
    [HttpPost("run/{runId:guid}/approve")]
    public async Task<IActionResult> ApprovePayrollRun(
        [FromRoute] Guid runId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var run = await dbContext.PayrollRuns
            .FirstOrDefaultAsync(x => x.Id == runId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (run is null)
        {
            return NotFound(new { Message = "Payroll run was not found.", RunId = runId });
        }

        if (run.Status == 2 || run.JournalEntryId.HasValue)
        {
            return Conflict(new { Message = "Posted payroll runs cannot be approved again.", RunId = runId, run.Status });
        }

        if (run.Status != 1)
        {
            return Conflict(new { Message = "Only submitted payroll runs can be approved.", RunId = runId, run.Status });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollRun","Approved",run.Id,run.PayrollPeriod,$"Payroll run '{run.PayrollPeriod}' approved.",User.Identity?.Name,tenantContext.TenantId,new { run.PayrollPeriod, run.Status },cancellationToken);

        return Ok(new
        {
            Message = "Payroll run approved successfully.",
            run.Id,
            run.PayrollPeriod,
            run.Status
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollRunReject)]
    [HttpPost("run/{runId:guid}/reject")]
    public async Task<IActionResult> RejectPayrollRun(
        [FromRoute] Guid runId,
        [FromBody] RejectPayrollRunRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (request is null || string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { Message = "Reject reason is required." });
        }

        var run = await dbContext.PayrollRuns
            .FirstOrDefaultAsync(x => x.Id == runId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (run is null)
        {
            return NotFound(new { Message = "Payroll run was not found.", RunId = runId });
        }

        if (run.Status == 2 || run.JournalEntryId.HasValue || run.PostedOnUtc.HasValue)
        {
            return Conflict(new { Message = "Posted payroll runs cannot be rejected.", RunId = runId, run.Status });
        }

        if (run.Status != 1)
        {
            return Conflict(new { Message = "Only submitted payroll runs can be rejected.", RunId = runId, run.Status });
        }

        dbContext.Entry(run).Property(nameof(PayrollRun.Status)).CurrentValue = 4;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollRun","Rejected",run.Id,run.PayrollPeriod,$"Payroll run '{run.PayrollPeriod}' rejected.",User.Identity?.Name,tenantContext.TenantId,new { Reason = request.Reason.Trim() },cancellationToken);

        return Ok(new
        {
            Message = "Payroll run rejected successfully.",
            run.Id,
            run.PayrollPeriod,
            Status = 4,
            Reason = request.Reason.Trim()
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpPost("run/{runId:guid}/reopen")]
    public async Task<IActionResult> ReopenRejectedPayrollRun(
        [FromRoute] Guid runId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var run = await dbContext.PayrollRuns
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == runId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (run is null)
        {
            return NotFound(new { Message = "Payroll run was not found.", RunId = runId });
        }

        if (run.Status != 4)
        {
            return Conflict(new { Message = "Only rejected payroll runs can be reopened to draft.", RunId = runId, run.Status });
        }

        dbContext.Entry(run).Property(nameof(PayrollRun.Status)).CurrentValue = 0;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollRun","Reopened",run.Id,run.PayrollPeriod,$"Rejected payroll run '{run.PayrollPeriod}' returned to draft.",User.Identity?.Name,tenantContext.TenantId,null,cancellationToken);

        return Ok(new
        {
            Message = "Rejected payroll run returned to draft successfully.",
            run.Id,
            run.PayrollPeriod,
            Status = 0
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpPost("run/{runId:guid}/resubmit")]
    public async Task<IActionResult> ResubmitRejectedPayrollRun(
        [FromRoute] Guid runId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var run = await dbContext.PayrollRuns
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == runId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (run is null)
        {
            return NotFound(new { Message = "Payroll run was not found.", RunId = runId });
        }

        if (run.Status != 4)
        {
            return Conflict(new { Message = "Only rejected payroll runs can be resubmitted.", RunId = runId, run.Status });
        }

        if (run.Lines.Count == 0)
        {
            return BadRequest(new { Message = "Rejected payroll run has no lines to resubmit.", RunId = runId });
        }

        dbContext.Entry(run).Property(nameof(PayrollRun.Status)).CurrentValue = 1;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollRun","Resubmitted",run.Id,run.PayrollPeriod,$"Rejected payroll run '{run.PayrollPeriod}' resubmitted.",User.Identity?.Name,tenantContext.TenantId,null,cancellationToken);

        return Ok(new
        {
            Message = "Rejected payroll run resubmitted successfully.",
            run.Id,
            run.PayrollPeriod,
            Status = 1
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpDelete("runs/{runId:guid}")]
    public async Task<IActionResult> DeletePayrollRun(
        [FromRoute] Guid runId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var run = await dbContext.PayrollRuns
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == runId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (run is null)
        {
            return NotFound(new { Message = "Payroll run was not found.", RunId = runId });
        }

        if (run.Status != 0 && run.Status != 4)
        {
            return Conflict(new
            {
                Message = "Only draft or rejected payroll runs can be deleted.",
                RunId = runId,
                run.PayrollPeriod,
                run.Status
            });
        }

        if (run.JournalEntryId.HasValue || run.PostedOnUtc.HasValue)
        {
            return Conflict(new
            {
                Message = "Posted payroll runs cannot be deleted.",
                RunId = runId,
                run.PayrollPeriod,
                run.JournalEntryId,
                run.PostedOnUtc
            });
        }

        var lineIds = run.Lines.Select(x => x.Id).ToList();

        if (lineIds.Count > 0)
        {
            var lineItems = await dbContext.Set<PayrollRunLineItem>()
                .Where(x => x.TenantId == tenantContext.TenantId && lineIds.Contains(x.PayrollRunLineId))
                .ToListAsync(cancellationToken);

            if (lineItems.Count > 0)
            {
                dbContext.Set<PayrollRunLineItem>().RemoveRange(lineItems);
            }

            dbContext.PayrollRunLines.RemoveRange(run.Lines);
        }

        dbContext.PayrollRuns.Remove(run);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollRun","Deleted",run.Id,run.PayrollPeriod,$"Payroll run '{run.PayrollPeriod}' deleted.",User.Identity?.Name,tenantContext.TenantId,null,cancellationToken);

        return Ok(new
        {
            Message = "Payroll run deleted successfully.",
            run.Id,
            run.PayrollPeriod
        });
    }


    [Authorize(Policy = AuthorizationPolicies.PayrollView)]
    [HttpGet("policy")]
    public async Task<IActionResult> GetPayrollPolicy(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var policy = await dbContext.Set<PayrollPolicySetting>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantContext.TenantId, cancellationToken);

        if (policy is null)
        {
            return Ok(new
            {
                Id = Guid.Empty,
                TenantId = tenantContext.TenantId,
                EnforceMinimumTakeHome = false,
                MinimumTakeHomeRuleType = "fixed_amount",
                MinimumTakeHomeAmount = 0m,
                MinimumTakeHomePercent = 0m,
                CurrencyCode = "NGN",
                CreatedOnUtc = DateTime.UtcNow,
                UpdatedOnUtc = DateTime.UtcNow
            });
        }

        return Ok(policy);
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpPut("policy")]
    public async Task<IActionResult> UpsertPayrollPolicy(
        [FromBody] UpdatePayrollPolicySettingRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (request.MinimumTakeHomeAmount < 0)
        {
            return BadRequest(new { Message = "Minimum take-home amount cannot be negative." });
        }

        if (request.MinimumTakeHomePercent < 0 || request.MinimumTakeHomePercent > 100)
        {
            return BadRequest(new { Message = "Minimum take-home percentage must be between 0 and 100." });
        }

        var normalizedRuleType = NormalizeMinimumTakeHomeRuleType(request.MinimumTakeHomeRuleType);

        var policy = await dbContext.Set<PayrollPolicySetting>()
            .FirstOrDefaultAsync(x => x.TenantId == tenantContext.TenantId, cancellationToken);

        if (policy is null)
        {
            policy = new PayrollPolicySetting(
                Guid.NewGuid(),
                tenantContext.TenantId,
                request.EnforceMinimumTakeHome,
                normalizedRuleType,
                request.MinimumTakeHomeAmount,
                request.MinimumTakeHomePercent,
                request.CurrencyCode);

            dbContext.Set<PayrollPolicySetting>().Add(policy);
        }
        else
        {
            policy.Update(request.EnforceMinimumTakeHome, normalizedRuleType, request.MinimumTakeHomeAmount, request.MinimumTakeHomePercent, request.CurrencyCode);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollPolicySetting","Saved",policy.Id,"payroll-policy","Payroll policy saved successfully.",User.Identity?.Name,tenantContext.TenantId,new { policy.EnforceMinimumTakeHome, policy.MinimumTakeHomeRuleType, policy.MinimumTakeHomeAmount, policy.MinimumTakeHomePercent, policy.CurrencyCode },cancellationToken);

        return Ok(new
        {
            Message = "Payroll policy saved successfully.",
            policy.Id,
            policy.EnforceMinimumTakeHome,
            policy.MinimumTakeHomeRuleType,
            policy.MinimumTakeHomeAmount,
            policy.MinimumTakeHomePercent,
            policy.CurrencyCode
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollView)]
    [HttpGet("runs")]
    public async Task<IActionResult> GetPayrollRuns(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var runs = await dbContext.PayrollRuns
            .AsNoTracking()
            .OrderByDescending(x => x.RunDateUtc)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.PayrollPeriod,
                x.RunDateUtc,
                x.Status,
                x.JournalEntryId,
                x.PostedOnUtc,
                EmployeeCount = x.Lines.Count,
                TotalGrossPay = x.Lines.Sum(line => line.GrossPay),
                TotalDeductions = x.Lines.Sum(line => line.TotalDeductions),
                TotalNetPay = x.Lines.Sum(line => line.NetPay)
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            Count = runs.Count,
            Items = runs
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollView)]
    [HttpGet("runs/{runId:guid}")]
    public async Task<IActionResult> GetPayrollRunDetail(
        [FromRoute] Guid runId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var run = await dbContext.PayrollRuns
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == runId, cancellationToken);

        if (run is null)
        {
            return NotFound(new { Message = "Payroll run was not found.", RunId = runId });
        }

        var employeeIds = run.Lines.Select(x => x.EmployeeId).Distinct().ToList();
        var runLineIds = run.Lines.Select(x => x.Id).Distinct().ToList();

        var employees = await dbContext.PayrollEmployees
            .AsNoTracking()
            .Where(x => employeeIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var lineItems = await dbContext.Set<PayrollRunLineItem>()
            .AsNoTracking()
            .Where(x => runLineIds.Contains(x.PayrollRunLineId))
            .OrderBy(x => x.Sequence)
            .ToListAsync(cancellationToken);

        var lineItemLookup = lineItems
            .GroupBy(x => x.PayrollRunLineId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var items = run.Lines
            .OrderBy(x => employees.TryGetValue(x.EmployeeId, out var employee) ? employee.EmployeeNumber : string.Empty)
            .Select(line =>
            {
                employees.TryGetValue(line.EmployeeId, out var employee);
                var itemRows = lineItemLookup.TryGetValue(line.Id, out var rows) ? rows : new List<PayrollRunLineItem>();

                return new
                {
                    PayrollRunLineId = line.Id,
                    line.PayrollRunId,
                    line.EmployeeId,
                    EmployeeNumber = employee?.EmployeeNumber ?? string.Empty,
                    EmployeeName = employee is null ? string.Empty : string.Join(" ", new[] { employee.FirstName, employee.MiddleName, employee.LastName }.Where(v => !string.IsNullOrWhiteSpace(v))),
                    employee?.Department,
                    employee?.JobTitle,
                    employee?.BankName,
                    employee?.BankAccountNumber,
                    employee?.PensionNumber,
                    employee?.TaxIdentificationNumber,
                    line.GrossPay,
                    line.TotalDeductions,
                    line.NetPay,
                    Items = itemRows.Select(item => new
                    {
                        item.Id,
                        item.PayrollRunLineId,
                        item.PayElementId,
                        item.Code,
                        item.Description,
                        item.ElementKind,
                        item.CalculationMode,
                        item.Amount,
                        item.Sequence,
                        item.IsTaxable
                    }).ToList()
                };
            })
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            PayrollRun = new
            {
                run.Id,
                run.TenantId,
                run.PayrollPeriod,
                run.RunDateUtc,
                run.Status,
                run.JournalEntryId,
                run.PostedOnUtc,
                EmployeeCount = items.Count,
                TotalGrossPay = items.Sum(x => x.GrossPay),
                TotalDeductions = items.Sum(x => x.TotalDeductions),
                TotalNetPay = items.Sum(x => x.NetPay)
            },
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollView)]
    [HttpGet("runs/{runId:guid}/payslips")]
    public async Task<IActionResult> GetPayrollPayslips(
        [FromRoute] Guid runId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var run = await dbContext.PayrollRuns
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == runId, cancellationToken);

        if (run is null)
        {
            return NotFound(new { Message = "Payroll run was not found.", RunId = runId });
        }

        var employeeIds = run.Lines.Select(x => x.EmployeeId).Distinct().ToList();
        var runLineIds = run.Lines.Select(x => x.Id).Distinct().ToList();

        var employees = await dbContext.PayrollEmployees
            .AsNoTracking()
            .Where(x => employeeIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var activeStructures = await dbContext.PayrollSalaryStructures
            .AsNoTracking()
            .Where(x => employeeIds.Contains(x.EmployeeId) && x.IsActive)
            .OrderByDescending(x => x.EffectiveFromUtc)
            .ToListAsync(cancellationToken);

        var lineItems = await dbContext.Set<PayrollRunLineItem>()
            .AsNoTracking()
            .Where(x => runLineIds.Contains(x.PayrollRunLineId))
            .OrderBy(x => x.Sequence)
            .ToListAsync(cancellationToken);

        var lineItemLookup = lineItems.GroupBy(x => x.PayrollRunLineId).ToDictionary(g => g.Key, g => g.ToList());

        var items = run.Lines
            .OrderBy(x => employees.TryGetValue(x.EmployeeId, out var employee) ? employee.EmployeeNumber : string.Empty)
            .Select(line =>
            {
                employees.TryGetValue(line.EmployeeId, out var employee);
                var structure = activeStructures.FirstOrDefault(x => x.EmployeeId == line.EmployeeId);
                var childItems = lineItemLookup.TryGetValue(line.Id, out var rows) ? rows : new List<PayrollRunLineItem>();

                return new
                {
                    PayslipNumber = $"PAYSLIP-{run.PayrollPeriod}-{employee?.EmployeeNumber ?? line.EmployeeId.ToString("N")[..8]}",
                    PayrollRunId = run.Id,
                    PayrollRunLineId = line.Id,
                    run.PayrollPeriod,
                    run.RunDateUtc,
                    run.Status,
                    run.JournalEntryId,
                    run.PostedOnUtc,
                    line.EmployeeId,
                    EmployeeNumber = employee?.EmployeeNumber ?? string.Empty,
                    EmployeeName = employee is null ? string.Empty : string.Join(" ", new[] { employee.FirstName, employee.MiddleName, employee.LastName }.Where(v => !string.IsNullOrWhiteSpace(v))),
                    employee?.Department,
                    employee?.JobTitle,
                    employee?.Email,
                    employee?.PhoneNumber,
                    employee?.BankName,
                    employee?.BankAccountNumber,
                    employee?.PensionNumber,
                    employee?.TaxIdentificationNumber,
                    CurrencyCode = structure?.CurrencyCode ?? "NGN",
                    Earnings = childItems.Where(x => x.ElementKind == 1).Select(x => new { x.Code, x.Description, x.Amount, x.Sequence }).ToList(),
                    Deductions = childItems.Where(x => x.ElementKind == 2).Select(x => new { x.Code, x.Description, x.Amount, x.Sequence }).ToList(),
                    line.GrossPay,
                    line.TotalDeductions,
                    line.NetPay
                };
            })
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            PayrollRun = new
            {
                run.Id,
                run.PayrollPeriod,
                run.RunDateUtc,
                run.Status,
                run.JournalEntryId,
                run.PostedOnUtc
            },
            Count = items.Count,
            Items = items
        });
    }


    // ==========================================
// PAYROLL / PHASE 1 — PAY GROUP COMPOSITION
// ==========================================

[Authorize(Policy = AuthorizationPolicies.PayrollView)]
[HttpGet("pay-group-elements/{payGroupId:guid}")]
public async Task<IActionResult> GetPayGroupElements(
    [FromRoute] Guid payGroupId,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
    CancellationToken cancellationToken)
{
    var tenantContext = tenantContextAccessor.Current;

    var items = await dbContext.Set<PayrollPayGroupElement>()
        .AsNoTracking()
        .Where(x => x.PayGroupId == payGroupId)
        .Join(
            dbContext.PayrollPayGroups.AsNoTracking(),
            item => item.PayGroupId,
            group => group.Id,
            (item, group) => new { item, group })
        .Join(
            dbContext.PayrollPayElements.AsNoTracking(),
            joined => joined.item.PayElementId,
            element => element.Id,
            (joined, element) => new
            {
                joined.item.Id,
                joined.item.TenantId,
                joined.item.PayGroupId,
                PayGroupCode = joined.group.Code,
                PayGroupName = joined.group.Name,
                joined.item.PayElementId,
                PayElementCode = element.Code,
                PayElementName = element.Name,
                element.ElementKind,
                element.CalculationMode,
                DefaultAmount = element.DefaultAmount,
                DefaultRate = element.DefaultRate,
                joined.item.Sequence,
                joined.item.AmountOverride,
                joined.item.RateOverride,
                joined.item.IsMandatory,
                joined.item.IsActive,
                joined.item.EffectiveFromUtc,
                joined.item.EffectiveToUtc,
                joined.item.Notes,
                joined.item.CreatedOnUtc
            })
        .OrderBy(x => x.Sequence)
        .ThenBy(x => x.PayElementCode)
        .ToListAsync(cancellationToken);

    return Ok(new
    {
        TenantContextAvailable = tenantContext.IsAvailable,
        TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
        TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
        Count = items.Count,
        Items = items
    });
}

[Authorize(Policy = AuthorizationPolicies.PayrollManage)]
[HttpPost("pay-group-elements")]
public async Task<IActionResult> CreatePayGroupElement(
    [FromBody] CreatePayrollPayGroupElementRequest request,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
    CancellationToken cancellationToken)
{
    var tenantContext = tenantContextAccessor.Current;

    if (!tenantContext.IsAvailable)
    {
        return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
    }

    var validation = ValidatePayGroupElementRequest(request);
    if (validation is not null)
    {
        return BadRequest(new { Message = validation });
    }

    var payGroup = await dbContext.PayrollPayGroups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.PayGroupId && x.TenantId == tenantContext.TenantId, cancellationToken);
    if (payGroup is null) return BadRequest(new { Message = "Selected pay group was not found." });

    var payElement = await dbContext.PayrollPayElements.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.PayElementId && x.TenantId == tenantContext.TenantId, cancellationToken);
    if (payElement is null) return BadRequest(new { Message = "Selected pay element was not found." });

    var duplicate = await dbContext.Set<PayrollPayGroupElement>().AsNoTracking().AnyAsync(
        x => x.TenantId == tenantContext.TenantId && x.PayGroupId == request.PayGroupId && x.PayElementId == request.PayElementId,
        cancellationToken);

    if (duplicate)
    {
        return Conflict(new { Message = "The selected pay element is already attached to this pay group.", request.PayGroupId, request.PayElementId });
    }

    var item = new PayrollPayGroupElement(
        Guid.NewGuid(),
        tenantContext.TenantId,
        request.PayGroupId,
        request.PayElementId,
        request.Sequence,
        request.AmountOverride,
        request.RateOverride,
        request.IsMandatory,
        request.IsActive,
        request.EffectiveFromUtc,
        request.EffectiveToUtc,
        request.Notes);

    dbContext.Set<PayrollPayGroupElement>().Add(item);
    await dbContext.SaveChangesAsync(cancellationToken);

    await auditTrailWriter.WriteAsync(
        "payroll","PayrollPayGroupElement","Created",item.Id,item.Id.ToString(),"Pay group composition item created successfully.",User.Identity?.Name,tenantContext.TenantId,new { item.PayGroupId, item.PayElementId, item.Sequence, item.IsActive },cancellationToken);

    return Ok(new { Message = "Pay group composition item created successfully.", item.Id, item.PayGroupId, item.PayElementId, item.Sequence });
}

[Authorize(Policy = AuthorizationPolicies.PayrollManage)]
[HttpPut("pay-group-elements/{payGroupElementId:guid}")]
public async Task<IActionResult> UpdatePayGroupElement(
    [FromRoute] Guid payGroupElementId,
    [FromBody] UpdatePayrollPayGroupElementRequest request,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
    CancellationToken cancellationToken)
{
    var tenantContext = tenantContextAccessor.Current;

    if (!tenantContext.IsAvailable)
    {
        return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
    }

    var validation = ValidatePayGroupElementUpdateRequest(request);
    if (validation is not null)
    {
        return BadRequest(new { Message = validation });
    }

    var item = await dbContext.Set<PayrollPayGroupElement>().FirstOrDefaultAsync(x => x.Id == payGroupElementId && x.TenantId == tenantContext.TenantId, cancellationToken);
    if (item is null) return NotFound(new { Message = "Pay group composition item was not found.", PayGroupElementId = payGroupElementId });

    item.Update(request.Sequence, request.AmountOverride, request.RateOverride, request.IsMandatory, request.IsActive, request.EffectiveFromUtc, request.EffectiveToUtc, request.Notes);
    await dbContext.SaveChangesAsync(cancellationToken);

    await auditTrailWriter.WriteAsync(
        "payroll","PayrollPayGroupElement","Updated",item.Id,item.Id.ToString(),"Pay group composition item updated successfully.",User.Identity?.Name,tenantContext.TenantId,new { item.PayGroupId, item.PayElementId, item.Sequence, item.IsActive },cancellationToken);

    return Ok(new { Message = "Pay group composition item updated successfully.", item.Id, item.Sequence, item.IsActive });
}

[Authorize(Policy = AuthorizationPolicies.PayrollManage)]
[HttpDelete("pay-group-elements/{payGroupElementId:guid}")]
public async Task<IActionResult> DeletePayGroupElement(
    [FromRoute] Guid payGroupElementId,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
    CancellationToken cancellationToken)
{
    var tenantContext = tenantContextAccessor.Current;

    if (!tenantContext.IsAvailable)
    {
        return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
    }

    var item = await dbContext.Set<PayrollPayGroupElement>().FirstOrDefaultAsync(x => x.Id == payGroupElementId && x.TenantId == tenantContext.TenantId, cancellationToken);
    if (item is null) return NotFound(new { Message = "Pay group composition item was not found.", PayGroupElementId = payGroupElementId });

    dbContext.Set<PayrollPayGroupElement>().Remove(item);
    await dbContext.SaveChangesAsync(cancellationToken);

    await auditTrailWriter.WriteAsync(
        "payroll","PayrollPayGroupElement","Deleted",item.Id,item.Id.ToString(),"Pay group composition item deleted successfully.",User.Identity?.Name,tenantContext.TenantId,null,cancellationToken);

    return Ok(new { Message = "Pay group composition item deleted successfully.", item.Id });
}


    [Authorize(Policy = AuthorizationPolicies.PayrollView)]
    [HttpGet("runs/{runId:guid}/statutory-report")]
    public async Task<IActionResult> GetPayrollStatutoryReport(
        [FromRoute] Guid runId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var run = await dbContext.PayrollRuns
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == runId, cancellationToken);

        if (run is null)
        {
            return NotFound(new { Message = "Payroll run was not found.", RunId = runId });
        }

        var employeeIds = run.Lines.Select(x => x.EmployeeId).Distinct().ToList();

        var employees = await dbContext.PayrollEmployees
            .AsNoTracking()
            .Where(x => employeeIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var items = run.Lines
            .OrderBy(x => employees.TryGetValue(x.EmployeeId, out var employee) ? employee.EmployeeNumber : string.Empty)
            .Select(line =>
            {
                employees.TryGetValue(line.EmployeeId, out var employee);

                return new
                {
                    line.EmployeeId,
                    EmployeeNumber = employee?.EmployeeNumber ?? string.Empty,
                    EmployeeName = employee is null ? string.Empty : string.Join(" ", new[] { employee.FirstName, employee.MiddleName, employee.LastName }.Where(v => !string.IsNullOrWhiteSpace(v))),
                    employee?.Department,
                    employee?.PensionNumber,
                    employee?.TaxIdentificationNumber,
                    GrossPay = line.GrossPay,
                    StatutoryDeductionAmount = line.TotalDeductions,
                    NetPay = line.NetPay
                };
            })
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            PayrollRun = new
            {
                run.Id,
                run.PayrollPeriod,
                run.RunDateUtc,
                run.Status,
                run.JournalEntryId,
                run.PostedOnUtc
            },
            Count = items.Count,
            TotalGrossPay = items.Sum(x => x.GrossPay),
            TotalStatutoryDeductions = items.Sum(x => x.StatutoryDeductionAmount),
            TotalNetPay = items.Sum(x => x.NetPay),
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollView)]
    [HttpGet("employees/{employeeId:guid}/history")]
    public async Task<IActionResult> GetEmployeePayrollHistory(
        [FromRoute] Guid employeeId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var employee = await dbContext.PayrollEmployees
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == employeeId, cancellationToken);

        if (employee is null)
        {
            return NotFound(new { Message = "Payroll employee was not found.", EmployeeId = employeeId });
        }

        var items = await dbContext.PayrollRunLines
            .AsNoTracking()
            .Where(x => x.EmployeeId == employeeId)
            .Join(
                dbContext.PayrollRuns.AsNoTracking(),
                line => line.PayrollRunId,
                run => run.Id,
                (line, run) => new
                {
                    PayrollRunLineId = line.Id,
                    PayrollRunId = run.Id,
                    run.PayrollPeriod,
                    run.RunDateUtc,
                    run.Status,
                    run.JournalEntryId,
                    run.PostedOnUtc,
                    line.GrossPay,
                    line.TotalDeductions,
                    line.NetPay
                })
            .OrderByDescending(x => x.RunDateUtc)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            Employee = new
            {
                employee.Id,
                employee.EmployeeNumber,
                EmployeeName = string.Join(" ", new[] { employee.FirstName, employee.MiddleName, employee.LastName }.Where(v => !string.IsNullOrWhiteSpace(v))),
                employee.Department,
                employee.JobTitle,
                employee.BankName,
                employee.BankAccountNumber,
                employee.PensionNumber,
                employee.TaxIdentificationNumber
            },
            Count = items.Count,
            TotalGrossPay = items.Sum(x => x.GrossPay),
            TotalDeductions = items.Sum(x => x.TotalDeductions),
            TotalNetPay = items.Sum(x => x.NetPay),
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollView)]
    [HttpGet("salary-structure-overrides/{salaryStructureId:guid}")]
    public async Task<IActionResult> GetSalaryStructureOverrides(
        [FromRoute] Guid salaryStructureId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var items = await dbContext.Set<PayrollSalaryStructureOverride>()
            .AsNoTracking()
            .Where(x => x.PayrollSalaryStructureId == salaryStructureId)
            .Join(
                dbContext.PayrollSalaryStructures.AsNoTracking(),
                item => item.PayrollSalaryStructureId,
                structure => structure.Id,
                (item, structure) => new { item, structure })
            .Join(
                dbContext.PayrollPayElements.AsNoTracking(),
                joined => joined.item.PayElementId,
                element => element.Id,
                (joined, element) => new
                {
                    joined.item.Id,
                    joined.item.TenantId,
                    joined.item.PayrollSalaryStructureId,
                    joined.structure.EmployeeId,
                    joined.structure.PayGroupId,
                    joined.item.PayElementId,
                    PayElementCode = element.Code,
                    PayElementName = element.Name,
                    element.ElementKind,
                    element.CalculationMode,
                    element.DefaultAmount,
                    element.DefaultRate,
                    joined.item.AmountOverride,
                    joined.item.RateOverride,
                    joined.item.IsExcluded,
                    joined.item.IsActive,
                    joined.item.EffectiveFromUtc,
                    joined.item.EffectiveToUtc,
                    joined.item.Notes,
                    joined.item.CreatedOnUtc
                })
            .OrderBy(x => x.PayElementCode)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpPost("salary-structure-overrides")]
    public async Task<IActionResult> CreateSalaryStructureOverride(
        [FromBody] CreatePayrollSalaryStructureOverrideRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var validation = ValidateSalaryStructureOverrideRequest(request);
        if (validation is not null)
        {
            return BadRequest(new { Message = validation });
        }

        var structure = await dbContext.PayrollSalaryStructures
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.PayrollSalaryStructureId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (structure is null)
        {
            return BadRequest(new { Message = "Selected salary structure was not found." });
        }

        var payElement = await dbContext.PayrollPayElements
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.PayElementId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (payElement is null)
        {
            return BadRequest(new { Message = "Selected pay element was not found." });
        }

        var duplicate = await dbContext.Set<PayrollSalaryStructureOverride>()
            .AsNoTracking()
            .AnyAsync(
                x => x.TenantId == tenantContext.TenantId &&
                     x.PayrollSalaryStructureId == request.PayrollSalaryStructureId &&
                     x.PayElementId == request.PayElementId,
                cancellationToken);

        if (duplicate)
        {
            return Conflict(new
            {
                Message = "An override for the selected pay element already exists on this salary structure.",
                request.PayrollSalaryStructureId,
                request.PayElementId
            });
        }

        var item = new PayrollSalaryStructureOverride(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.PayrollSalaryStructureId,
            request.PayElementId,
            request.AmountOverride,
            request.RateOverride,
            request.IsExcluded,
            request.IsActive,
            request.EffectiveFromUtc,
            request.EffectiveToUtc,
            request.Notes);

        dbContext.Set<PayrollSalaryStructureOverride>().Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollSalaryStructureOverride","Created",item.Id,item.Id.ToString(),"Salary structure override created successfully.",User.Identity?.Name,tenantContext.TenantId,new { item.PayrollSalaryStructureId, item.PayElementId, item.IsActive },cancellationToken);

        return Ok(new
        {
            Message = "Salary structure override created successfully.",
            item.Id,
            item.PayrollSalaryStructureId,
            item.PayElementId
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpPut("salary-structure-overrides/{salaryStructureOverrideId:guid}")]
    public async Task<IActionResult> UpdateSalaryStructureOverride(
        [FromRoute] Guid salaryStructureOverrideId,
        [FromBody] UpdatePayrollSalaryStructureOverrideRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var validation = ValidateSalaryStructureOverrideUpdateRequest(request);
        if (validation is not null)
        {
            return BadRequest(new { Message = validation });
        }

        var item = await dbContext.Set<PayrollSalaryStructureOverride>()
            .FirstOrDefaultAsync(x => x.Id == salaryStructureOverrideId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (item is null)
        {
            return NotFound(new { Message = "Salary structure override was not found.", SalaryStructureOverrideId = salaryStructureOverrideId });
        }

        item.Update(
            request.AmountOverride,
            request.RateOverride,
            request.IsExcluded,
            request.IsActive,
            request.EffectiveFromUtc,
            request.EffectiveToUtc,
            request.Notes);

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollSalaryStructureOverride","Updated",item.Id,item.Id.ToString(),"Salary structure override updated successfully.",User.Identity?.Name,tenantContext.TenantId,new { item.PayrollSalaryStructureId, item.PayElementId, item.IsActive, item.IsExcluded },cancellationToken);

        return Ok(new
        {
            Message = "Salary structure override updated successfully.",
            item.Id,
            item.IsExcluded,
            item.IsActive
        });
    }

    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpDelete("salary-structure-overrides/{salaryStructureOverrideId:guid}")]
    public async Task<IActionResult> DeleteSalaryStructureOverride(
        [FromRoute] Guid salaryStructureOverrideId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var item = await dbContext.Set<PayrollSalaryStructureOverride>()
            .FirstOrDefaultAsync(x => x.Id == salaryStructureOverrideId && x.TenantId == tenantContext.TenantId, cancellationToken);

        if (item is null)
        {
            return NotFound(new { Message = "Salary structure override was not found.", SalaryStructureOverrideId = salaryStructureOverrideId });
        }

        dbContext.Set<PayrollSalaryStructureOverride>().Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollSalaryStructureOverride","Deleted",item.Id,item.Id.ToString(),"Salary structure override deleted successfully.",User.Identity?.Name,tenantContext.TenantId,null,cancellationToken);

        return Ok(new
        {
            Message = "Salary structure override deleted successfully.",
            item.Id
        });
    }

public sealed record CreatePayrollSalaryStructureOverrideRequest(
    Guid PayrollSalaryStructureId,
    Guid PayElementId,
    decimal? AmountOverride,
    decimal? RateOverride,
    bool IsExcluded,
    bool IsActive,
    DateTime? EffectiveFromUtc,
    DateTime? EffectiveToUtc,
    string? Notes);

public sealed record UpdatePayrollSalaryStructureOverrideRequest(
    decimal? AmountOverride,
    decimal? RateOverride,
    bool IsExcluded,
    bool IsActive,
    DateTime? EffectiveFromUtc,
    DateTime? EffectiveToUtc,
    string? Notes);

private static string? ValidateSalaryStructureOverrideRequest(CreatePayrollSalaryStructureOverrideRequest request)
{
    if (request.PayrollSalaryStructureId == Guid.Empty) return "Salary structure is required.";
    if (request.PayElementId == Guid.Empty) return "Pay element is required.";
    if (request.EffectiveFromUtc.HasValue && request.EffectiveToUtc.HasValue && request.EffectiveToUtc < request.EffectiveFromUtc)
    {
        return "Effective to date cannot be earlier than effective from date.";
    }
    return null;
}

private static string? ValidateSalaryStructureOverrideUpdateRequest(UpdatePayrollSalaryStructureOverrideRequest request)
{
    if (request.EffectiveFromUtc.HasValue && request.EffectiveToUtc.HasValue && request.EffectiveToUtc < request.EffectiveFromUtc)
    {
        return "Effective to date cannot be earlier than effective from date.";
    }
    return null;
}


public sealed record SubmitPayrollRunRequest(string? Notes);
public sealed record RejectPayrollRunRequest(string Reason);

public sealed record UpdatePayrollPolicySettingRequest(bool EnforceMinimumTakeHome, string MinimumTakeHomeRuleType, decimal MinimumTakeHomeAmount, decimal MinimumTakeHomePercent, string CurrencyCode);


private static DateTime ResolvePayrollRunPostingDateUtc(string payrollPeriod)
{
    if (DateTime.TryParse($"{payrollPeriod}-01", out var parsed))
    {
        var monthEnd = new DateTime(parsed.Year, parsed.Month, DateTime.DaysInMonth(parsed.Year, parsed.Month), 0, 0, 0, DateTimeKind.Utc);
        return monthEnd;
    }

    return DateTime.UtcNow;
}

private static string NormalizeMinimumTakeHomeRuleType(string? value)
{
    var normalized = (value ?? "fixed_amount").Trim().ToLowerInvariant();
    return normalized == "gross_percentage" ? "gross_percentage" : "fixed_amount";
}

private static string? ValidateEmployeeRequest(CreatePayrollEmployeeRequest request)
{
    if (string.IsNullOrWhiteSpace(request.EmployeeNumber)) return "Employee number is required.";
    if (string.IsNullOrWhiteSpace(request.FirstName)) return "First name is required.";
    if (string.IsNullOrWhiteSpace(request.LastName)) return "Last name is required.";
    if (request.HireDateUtc == default) return "Hire date is required.";
    return null;
}

private static string? ValidateEmployeeUpdateRequest(UpdatePayrollEmployeeRequest request)
{
    if (string.IsNullOrWhiteSpace(request.FirstName)) return "First name is required.";
    if (string.IsNullOrWhiteSpace(request.LastName)) return "Last name is required.";
    if (request.HireDateUtc == default) return "Hire date is required.";
    return null;
}



private static string? ValidatePayGroupElementRequest(CreatePayrollPayGroupElementRequest request)
{
    if (request.PayGroupId == Guid.Empty) return "Pay group is required.";
    if (request.PayElementId == Guid.Empty) return "Pay element is required.";
    if (request.Sequence < 1) return "Sequence must be at least 1.";
    if (request.EffectiveFromUtc.HasValue && request.EffectiveToUtc.HasValue && request.EffectiveToUtc < request.EffectiveFromUtc)
        return "Effective to date cannot be earlier than effective from date.";
    return null;
}

private static string? ValidatePayGroupElementUpdateRequest(UpdatePayrollPayGroupElementRequest request)
{
    if (request.Sequence < 1) return "Sequence must be at least 1.";
    if (request.EffectiveFromUtc.HasValue && request.EffectiveToUtc.HasValue && request.EffectiveToUtc < request.EffectiveFromUtc)
        return "Effective to date cannot be earlier than effective from date.";
    return null;
}



    [Authorize(Policy = AuthorizationPolicies.PayrollManage)]
    [HttpPost("run")]
    public async Task<IActionResult> GeneratePayrollRun(
        [FromQuery] string period,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(period))
        {
            return BadRequest(new { Message = "Payroll period is required." });
        }

        if (!DateTime.TryParse($"{period.Trim()}-01", out var parsedPeriodStart))
        {
            return BadRequest(new { Message = "Payroll period must be in YYYY-MM format.", PayrollPeriod = period.Trim() });
        }

        var periodStartUtc = DateTime.SpecifyKind(new DateTime(parsedPeriodStart.Year, parsedPeriodStart.Month, 1), DateTimeKind.Utc);
        var periodEndUtc = DateTime.SpecifyKind(periodStartUtc.AddMonths(1).AddDays(-1), DateTimeKind.Utc);
        var normalizedPeriod = periodStartUtc.ToString("yyyy-MM");

        var existingRun = await dbContext.PayrollRuns
            .AsNoTracking()
            .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.PayrollPeriod == normalizedPeriod, cancellationToken);

        if (existingRun)
        {
            return Conflict(new { Message = "A payroll run already exists for the selected period.", PayrollPeriod = normalizedPeriod });
        }

        var employees = await dbContext.PayrollEmployees
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId && x.IsActive)
            .OrderBy(x => x.EmployeeNumber)
            .ToListAsync(cancellationToken);

        if (employees.Count == 0)
        {
            return BadRequest(new { Message = "No active payroll employees were found." });
        }

        var payGroups = await dbContext.PayrollPayGroups
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId && x.IsActive)
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var salaryStructures = await dbContext.PayrollSalaryStructures
            .AsNoTracking()
            .Where(x =>
                x.TenantId == tenantContext.TenantId &&
                x.IsActive &&
                x.EffectiveFromUtc <= periodEndUtc)
            .OrderByDescending(x => x.EffectiveFromUtc)
            .ToListAsync(cancellationToken);

        var payGroupElements = await dbContext.Set<PayrollPayGroupElement>()
            .AsNoTracking()
            .Where(x =>
                x.TenantId == tenantContext.TenantId &&
                x.IsActive &&
                (!x.EffectiveFromUtc.HasValue || x.EffectiveFromUtc.Value <= periodEndUtc) &&
                (!x.EffectiveToUtc.HasValue || x.EffectiveToUtc.Value >= periodStartUtc))
            .OrderBy(x => x.Sequence)
            .ToListAsync(cancellationToken);

        var payElements = await dbContext.PayrollPayElements
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId && x.IsActive)
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var salaryOverrides = await dbContext.Set<PayrollSalaryStructureOverride>()
            .AsNoTracking()
            .Where(x =>
                x.TenantId == tenantContext.TenantId &&
                x.IsActive &&
                (!x.EffectiveFromUtc.HasValue || x.EffectiveFromUtc.Value <= periodEndUtc) &&
                (!x.EffectiveToUtc.HasValue || x.EffectiveToUtc.Value >= periodStartUtc))
            .ToListAsync(cancellationToken);

        var payrollPolicy = await dbContext.Set<PayrollPolicySetting>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantContext.TenantId, cancellationToken);

        var run = new PayrollRun(Guid.NewGuid(), tenantContext.TenantId, normalizedPeriod);
        dbContext.PayrollRuns.Add(run);

        var generatedItemCount = 0;
        var skippedEmployees = new List<object>();

        foreach (var employee in employees)
        {
            var structure = salaryStructures.FirstOrDefault(x => x.EmployeeId == employee.Id);

            if (structure is null)
            {
                skippedEmployees.Add(new
                {
                    employee.Id,
                    employee.EmployeeNumber,
                    EmployeeName = string.Join(" ", new[] { employee.FirstName, employee.MiddleName, employee.LastName }.Where(v => !string.IsNullOrWhiteSpace(v))),
                    Reason = "No active salary structure effective for the selected payroll period."
                });
                continue;
            }

            if (!payGroups.TryGetValue(structure.PayGroupId, out _))
            {
                skippedEmployees.Add(new
                {
                    employee.Id,
                    employee.EmployeeNumber,
                    EmployeeName = string.Join(" ", new[] { employee.FirstName, employee.MiddleName, employee.LastName }.Where(v => !string.IsNullOrWhiteSpace(v))),
                    Reason = "Assigned pay group was not found or is inactive."
                });
                continue;
            }

            var line = new PayrollRunLine(Guid.NewGuid(), tenantContext.TenantId, run.Id, employee.Id);
            var lineItems = new List<PayrollRunLineItem>();

            var compositions = payGroupElements
                .Where(x => x.PayGroupId == structure.PayGroupId)
                .OrderBy(x => x.Sequence)
                .ToList();

            var structureOverrides = salaryOverrides
                .Where(x => x.PayrollSalaryStructureId == structure.Id)
                .ToDictionary(x => x.PayElementId, x => x);

            var hasBasicInComposition = false;

            foreach (var composition in compositions)
            {
                if (!payElements.TryGetValue(composition.PayElementId, out var payElement))
                {
                    continue;
                }

                if (string.Equals(payElement.Code, "BASIC", StringComparison.OrdinalIgnoreCase))
                {
                    hasBasicInComposition = true;
                }

                structureOverrides.TryGetValue(payElement.Id, out var overrideItem);

                if (overrideItem?.IsExcluded == true)
                {
                    continue;
                }

                var rateToUse = overrideItem?.RateOverride
                    ?? composition.RateOverride
                    ?? payElement.DefaultRate;

                var amountToUse = overrideItem?.AmountOverride
                    ?? composition.AmountOverride
                    ?? payElement.DefaultAmount;

                var usePercentageCalculation =
                    payElement.CalculationMode == 2 ||
                    (rateToUse > 0m && overrideItem?.AmountOverride is null && composition.AmountOverride is null);

                var calculatedAmount = usePercentageCalculation
                    ? Math.Round(structure.BasicSalary * (rateToUse / 100m), 2)
                    : amountToUse;

                if (string.Equals(payElement.Code, "BASIC", StringComparison.OrdinalIgnoreCase))
                {
                    calculatedAmount = structure.BasicSalary;
                }

                if (calculatedAmount == 0m && !composition.IsMandatory)
                {
                    continue;
                }

                lineItems.Add(new PayrollRunLineItem(
                    Guid.NewGuid(),
                    tenantContext.TenantId,
                    line.Id,
                    payElement.Id,
                    payElement.Code,
                    payElement.Name,
                    payElement.ElementKind,
                    usePercentageCalculation ? 2 : payElement.CalculationMode,
                    calculatedAmount,
                    composition.Sequence,
                    payElement.IsTaxable));
            }

            if (!hasBasicInComposition)
            {
                lineItems.Insert(0, new PayrollRunLineItem(
                    Guid.NewGuid(),
                    tenantContext.TenantId,
                    line.Id,
                    null,
                    "BASIC",
                    "Basic Salary",
                    1,
                    1,
                    structure.BasicSalary,
                    1,
                    true));
            }

            var gross = lineItems.Where(x => x.ElementKind == 1).Sum(x => x.Amount);
            var deductions = lineItems.Where(x => x.ElementKind == 2).Sum(x => x.Amount);

            if (gross < deductions)
            {
                skippedEmployees.Add(new
                {
                    employee.Id,
                    employee.EmployeeNumber,
                    EmployeeName = string.Join(" ", new[] { employee.FirstName, employee.MiddleName, employee.LastName }.Where(v => !string.IsNullOrWhiteSpace(v))),
                    Reason = "Calculated deductions exceed gross pay."
                });
                continue;
            }

            line.SetValues(gross, deductions);
            run.AddLine(line);

            dbContext.Set<PayrollRunLineItem>().AddRange(lineItems);
            generatedItemCount += lineItems.Count;
        }

        if (run.Lines.Count == 0)
        {
            return BadRequest(new
            {
                Message = "No payroll lines were generated. Review salary structures, pay groups, and effective dates.",
                PayrollPeriod = normalizedPeriod,
                SkippedEmployees = skippedEmployees
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "payroll","PayrollRun","Generated",run.Id,run.PayrollPeriod,$"Payroll run '{run.PayrollPeriod}' generated.",User.Identity?.Name,tenantContext.TenantId,new { run.PayrollPeriod, LineCount = run.Lines.Count, run.Status },cancellationToken);

        return Ok(new
        {
            Message = "Payroll run generated successfully.",
            run.Id,
            run.PayrollPeriod,
            PayrollPeriodStartUtc = periodStartUtc,
            PayrollPeriodEndUtc = periodEndUtc,
            EmployeeCount = run.Lines.Count,
            SkippedEmployeeCount = skippedEmployees.Count,
            SkippedEmployees = skippedEmployees,
            LineItemCount = generatedItemCount,
            TotalGrossPay = run.Lines.Sum(x => x.GrossPay),
            TotalDeductions = run.Lines.Sum(x => x.TotalDeductions),
            TotalNetPay = run.Lines.Sum(x => x.NetPay)
        });
    }
}


public sealed class PostPayrollRunRequest
{
    public Guid SalaryExpenseAccountId { get; set; }
    public Guid DeductionsPayableAccountId { get; set; }
    public Guid NetSalaryPayableAccountId { get; set; }
    public DateTime? PostingDateUtc { get; set; }
    public string? Reference { get; set; }
    public string? Description { get; set; }
}


public sealed record CreatePayrollEmployeeRequest(
    string EmployeeNumber,
    string FirstName,
    string? MiddleName,
    string LastName,
    string? Email,
    string? PhoneNumber,
    string? Department,
    string? JobTitle,
    DateTime HireDateUtc,
    string? BankName,
    string? BankAccountNumber,
    string? PensionNumber,
    string? TaxIdentificationNumber,
    bool IsActive,
    string? Notes);


public sealed record UpdatePayrollEmployeeRequest(
    string FirstName,
    string? MiddleName,
    string LastName,
    string? Email,
    string? PhoneNumber,
    string? Department,
    string? JobTitle,
    DateTime HireDateUtc,
    string? BankName,
    string? BankAccountNumber,
    string? PensionNumber,
    string? TaxIdentificationNumber,
    bool IsActive,
    string? Notes);


public sealed record ImportPayrollEmployeesRequest(List<CreatePayrollEmployeeRequest> Items);




public sealed record CreatePayrollPayGroupRequest(
    string Code,
    string Name,
    string? Description,
    bool IsActive);


public sealed record UpdatePayrollPayGroupRequest(
    string Name,
    string? Description,
    bool IsActive);

public sealed record CreatePayrollPayElementRequest(
    string Code,
    string Name,
    int ElementKind,
    int CalculationMode,
    decimal DefaultAmount,
    decimal DefaultRate,
    Guid LedgerAccountId,
    bool IsTaxable,
    bool IsActive,
    string? Description);

public sealed record UpdatePayrollPayElementRequest(
    string Name,
    int ElementKind,
    int CalculationMode,
    decimal DefaultAmount,
    decimal DefaultRate,
    Guid LedgerAccountId,
    bool IsTaxable,
    bool IsActive,
    string? Description);

public sealed record CreatePayrollSalaryStructureRequest(
    Guid EmployeeId,
    Guid PayGroupId,
    decimal BasicSalary,
    string CurrencyCode,
    DateTime EffectiveFromUtc,
    bool IsActive,
    string? Notes);

public sealed record UpdatePayrollSalaryStructureRequest(
    Guid EmployeeId,
    Guid PayGroupId,
    decimal BasicSalary,
    string CurrencyCode,
    DateTime EffectiveFromUtc,
    bool IsActive,
    string? Notes);

public sealed record CreatePayrollPayGroupElementRequest(
    Guid PayGroupId,
    Guid PayElementId,
    int Sequence,
    decimal? AmountOverride,
    decimal? RateOverride,
    bool IsMandatory,
    bool IsActive,
    DateTime? EffectiveFromUtc,
    DateTime? EffectiveToUtc,
    string? Notes);

public sealed record UpdatePayrollPayGroupElementRequest(
    int Sequence,
    decimal? AmountOverride,
    decimal? RateOverride,
    bool IsMandatory,
    bool IsActive,
    DateTime? EffectiveFromUtc,
    DateTime? EffectiveToUtc,
    string? Notes);
