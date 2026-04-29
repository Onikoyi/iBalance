using iBalance.Api.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Finance.Domain.Entities;
using iBalance.Modules.Finance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/payroll")]
public sealed class PayrollController : ControllerBase
{
[Authorize(Policy = AuthorizationPolicies.FinanceView)]
[HttpGet("employees")]
public async Task<IActionResult> GetEmployees(
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
    CancellationToken cancellationToken)
{
    var tenantContext = tenantContextAccessor.Current;

    var items = await dbContext.PayrollEmployees
        .AsNoTracking()
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
        TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
        TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
        Count = items.Count,
        Items = items
    });
}

[Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
[HttpPost("employees")]
public async Task<IActionResult> CreateEmployee(
    [FromBody] CreatePayrollEmployeeRequest request,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
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

    return Ok(new { Message = "Payroll employee created successfully.", employee.Id, employee.EmployeeNumber, employee.FullName });
}

[Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
[HttpPut("employees/{employeeId:guid}")]
public async Task<IActionResult> UpdateEmployee(
    [FromRoute] Guid employeeId,
    [FromBody] UpdatePayrollEmployeeRequest request,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
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

    return Ok(new
    {
        Message = "Payroll employee updated successfully.",
        employee.Id,
        employee.EmployeeNumber,
        employee.FullName,
        employee.IsActive
    });
}

[Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
[HttpDelete("employees/{employeeId:guid}")]
public async Task<IActionResult> DeleteEmployee(
    [FromRoute] Guid employeeId,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
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

    return Ok(new
    {
        Message = "Payroll employee deleted successfully.",
        employee.Id,
        employee.EmployeeNumber,
        employee.FullName
    });
}

[Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
[HttpPost("employees/import")]
public async Task<IActionResult> ImportEmployees(
    [FromBody] ImportPayrollEmployeesRequest request,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
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

    return Ok(new
    {
        Message = "Payroll employees imported successfully.",
        Count = imported.Count,
        Items = imported.Select(x => new { x.Id, x.EmployeeNumber, x.FirstName, x.MiddleName, x.LastName, x.FullName }).ToList()
    });
}



    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
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

    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpPost("pay-groups")]
    public async Task<IActionResult> CreatePayGroup(
        [FromBody] CreatePayrollPayGroupRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
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

        return Ok(new { Message = "Payroll pay group created successfully.", payGroup.Id, payGroup.Code });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpPut("pay-groups/{payGroupId:guid}")]
    public async Task<IActionResult> UpdatePayGroup(
        [FromRoute] Guid payGroupId,
        [FromBody] UpdatePayrollPayGroupRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
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

    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpDelete("pay-groups/{payGroupId:guid}")]
    public async Task<IActionResult> DeletePayGroup(
        [FromRoute] Guid payGroupId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
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

        return Ok(new
        {
            Message = "Payroll pay group deleted successfully.",
            payGroup.Id,
            payGroup.Code
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
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

    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpPost("pay-elements")]
    public async Task<IActionResult> CreatePayElement(
        [FromBody] CreatePayrollPayElementRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
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

        return Ok(new { Message = "Payroll pay element created successfully.", element.Id, element.Code });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpPut("pay-elements/{payElementId:guid}")]
    public async Task<IActionResult> UpdatePayElement(
        [FromRoute] Guid payElementId,
        [FromBody] UpdatePayrollPayElementRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
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

    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpDelete("pay-elements/{payElementId:guid}")]
    public async Task<IActionResult> DeletePayElement(
        [FromRoute] Guid payElementId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
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

        return Ok(new
        {
            Message = "Payroll pay element deleted successfully.",
            payElement.Id,
            payElement.Code
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
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

    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpPost("salary-structures")]
    public async Task<IActionResult> CreateSalaryStructure(
        [FromBody] CreatePayrollSalaryStructureRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
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

        return Ok(new { Message = "Payroll salary structure created successfully.", structure.Id });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpPut("salary-structures/{salaryStructureId:guid}")]
    public async Task<IActionResult> UpdateSalaryStructure(
        [FromRoute] Guid salaryStructureId,
        [FromBody] UpdatePayrollSalaryStructureRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
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

    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpDelete("salary-structures/{salaryStructureId:guid}")]
    public async Task<IActionResult> DeleteSalaryStructure(
        [FromRoute] Guid salaryStructureId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
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


    [Authorize(Policy = AuthorizationPolicies.FinanceJournalsPost)]
    [HttpPost("run/{runId:guid}/post")]
    public async Task<IActionResult> PostPayrollRun(
        [FromRoute] Guid runId,
        [FromBody] PostPayrollRunRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
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
            return BadRequest(new { Message = "Salary expense, deductions payable, and net salary payable accounts are required." });
        }

        var run = await dbContext.PayrollRuns
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == runId, cancellationToken);

        if (run is null)
        {
            return NotFound(new { Message = "Payroll run was not found.", RunId = runId });
        }

        if (run.Status == 2 || run.JournalEntryId.HasValue)
        {
            return Conflict(new { Message = "Payroll run has already been posted.", RunId = runId, run.JournalEntryId });
        }

        if (run.Lines.Count == 0)
        {
            return BadRequest(new { Message = "Payroll run has no lines to post." });
        }

        var postingDateUtc = request.PostingDateUtc ?? DateTime.UtcNow;
        var postingDate = DateOnly.FromDateTime(postingDateUtc);

        var fiscalPeriod = await dbContext.FiscalPeriods
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.StartDate <= postingDate &&
                x.EndDate >= postingDate,
                cancellationToken);

        if (fiscalPeriod is null)
        {
            return BadRequest(new { Message = "No fiscal period exists for the payroll posting date.", PostingDateUtc = postingDateUtc });
        }

        if (fiscalPeriod.Status != FiscalPeriodStatus.Open)
        {
            return BadRequest(new { Message = "Posting blocked: the selected fiscal month is closed or not open for posting.", PostingDateUtc = postingDateUtc, FiscalPeriod = fiscalPeriod.Name });
        }

        var requestedAccountIds = new[]
        {
            request.SalaryExpenseAccountId,
            request.DeductionsPayableAccountId,
            request.NetSalaryPayableAccountId
        }.Distinct().ToList();

        var accounts = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => requestedAccountIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        foreach (var ledgerAccountId in requestedAccountIds)
        {
            if (!accounts.TryGetValue(ledgerAccountId, out var account))
            {
                return BadRequest(new { Message = "One or more selected payroll posting accounts were not found.", LedgerAccountId = ledgerAccountId });
            }

            if (!account.IsActive || account.IsHeader || !account.IsPostingAllowed)
            {
                return BadRequest(new { Message = "Payroll posting accounts must be active, non-header, posting-enabled ledger accounts.", account.Id, account.Code, account.Name });
            }
        }

        var totalGross = run.Lines.Sum(x => x.GrossPay);
        var totalDeductions = run.Lines.Sum(x => x.TotalDeductions);
        var totalNetPay = run.Lines.Sum(x => x.NetPay);

        if (totalGross <= 0m)
        {
            return BadRequest(new { Message = "Payroll gross amount must be greater than zero before posting." });
        }

        var journalLines = new List<JournalEntryLine>
        {
            new(
                Guid.NewGuid(),
                request.SalaryExpenseAccountId,
                $"Payroll salary expense - {run.PayrollPeriod}",
                totalGross,
                0m)
        };

        if (totalDeductions > 0m)
        {
            journalLines.Add(new JournalEntryLine(
                Guid.NewGuid(),
                request.DeductionsPayableAccountId,
                $"Payroll statutory/employee deductions payable - {run.PayrollPeriod}",
                0m,
                totalDeductions));
        }

        if (totalNetPay > 0m)
        {
            journalLines.Add(new JournalEntryLine(
                Guid.NewGuid(),
                request.NetSalaryPayableAccountId,
                $"Net salary payable - {run.PayrollPeriod}",
                0m,
                totalNetPay));
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
            journalLines);

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
            PayrollRun = new
            {
                run.Id,
                run.PayrollPeriod,
                run.Status,
                run.JournalEntryId,
                run.PostedOnUtc,
                EmployeeCount = run.Lines.Count,
                TotalGross = totalGross,
                TotalDeductions = totalDeductions,
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


    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
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

    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
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
                    line.Id,
                    line.TenantId,
                    line.PayrollRunId,
                    line.EmployeeId,
                    EmployeeNumber = employee?.EmployeeNumber ?? string.Empty,
                    EmployeeName = employee is null ? string.Empty : $"{employee.FirstName} {employee.LastName}".Trim(),
                    employee?.Department,
                    employee?.JobTitle,
                    employee?.BankName,
                    employee?.BankAccountNumber,
                    employee?.PensionNumber,
                    employee?.TaxIdentificationNumber,
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

    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
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

        var employees = await dbContext.PayrollEmployees
            .AsNoTracking()
            .Where(x => employeeIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var activeStructures = await dbContext.PayrollSalaryStructures
            .AsNoTracking()
            .Where(x => employeeIds.Contains(x.EmployeeId) && x.IsActive)
            .OrderByDescending(x => x.EffectiveFromUtc)
            .ToListAsync(cancellationToken);

        var items = run.Lines
            .OrderBy(x => employees.TryGetValue(x.EmployeeId, out var employee) ? employee.EmployeeNumber : string.Empty)
            .Select(line =>
            {
                employees.TryGetValue(line.EmployeeId, out var employee);
                var structure = activeStructures.FirstOrDefault(x => x.EmployeeId == line.EmployeeId);

                var deductionLabel = line.TotalDeductions > 0m ? "Statutory/Employee Deductions" : "No deductions";
                var grossLabel = "Basic Salary / Gross Earnings";

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
                    EmployeeName = employee is null ? string.Empty : $"{employee.FirstName} {employee.LastName}".Trim(),
                    employee?.Department,
                    employee?.JobTitle,
                    employee?.Email,
                    employee?.PhoneNumber,
                    employee?.BankName,
                    employee?.BankAccountNumber,
                    employee?.PensionNumber,
                    employee?.TaxIdentificationNumber,
                    CurrencyCode = structure?.CurrencyCode ?? "NGN",
                    Earnings = new[]
                    {
                        new
                        {
                            Code = "BASIC",
                            Description = grossLabel,
                            Amount = line.GrossPay
                        }
                    },
                    Deductions = line.TotalDeductions > 0m
                        ? new[]
                        {
                            new
                            {
                                Code = "DED",
                                Description = deductionLabel,
                                Amount = line.TotalDeductions
                            }
                        }
                        : Array.Empty<object>(),
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

    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
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
                    EmployeeName = employee is null ? string.Empty : $"{employee.FirstName} {employee.LastName}".Trim(),
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

    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
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
                EmployeeName = $"{employee.FirstName} {employee.LastName}".Trim(),
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


    [HttpPost("run")]
public async Task<IActionResult> GeneratePayrollRun(
    [FromQuery] string period,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
    CancellationToken cancellationToken)
{
    var tenant = tenantContextAccessor.Current;

    if (!tenant.IsAvailable)
        return BadRequest("Tenant required");

    var employees = await dbContext.PayrollEmployees
        .Where(x => x.IsActive)
        .ToListAsync(cancellationToken);

    var salaries = await dbContext.PayrollSalaryStructures
        .Where(x => x.IsActive)
        .ToListAsync(cancellationToken);

    var run = new PayrollRun(Guid.NewGuid(), tenant.TenantId, period);

    foreach (var emp in employees)
    {
        var salary = salaries.FirstOrDefault(x => x.EmployeeId == emp.Id);

        if (salary == null) continue;

        var gross = salary.BasicSalary;
        var deductions = gross * 0.10m; // TEMP rule (10%)

        var line = new PayrollRunLine(Guid.NewGuid(), tenant.TenantId, run.Id, emp.Id);
        line.SetValues(gross, deductions);

        run.AddLine(line);
    }

    dbContext.PayrollRuns.Add(run);
    await dbContext.SaveChangesAsync(cancellationToken);

    return Ok(new
    {
        Message = "Payroll run generated",
        run.Id,
        run.PayrollPeriod,
        EmployeeCount = run.Lines.Count
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
