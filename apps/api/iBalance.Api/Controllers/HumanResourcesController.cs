using iBalance.Api.Security;
using iBalance.Api.Services.Audit;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.HumanResources.Domain.Entities;
using iBalance.Modules.HumanResources.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/hr")]
public sealed class HumanResourcesController : ControllerBase
{
    private static string? TrimToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string CurrentUserName(System.Security.Claims.ClaimsPrincipal user) =>
        user.Identity?.Name ?? "system";

    private static async Task<IActionResult?> ValidateReferencesAsync(
        ApplicationDbContext dbContext,
        Guid? departmentId,
        Guid? designationId,
        Guid? gradeId,
        CancellationToken cancellationToken)
    {
        if (departmentId.HasValue)
        {
            var exists = await dbContext.HrDepartments.AsNoTracking().AnyAsync(x => x.Id == departmentId.Value && x.IsActive, cancellationToken);
            if (!exists) return new BadRequestObjectResult(new { Message = "Selected HR department was not found or is inactive.", DepartmentId = departmentId.Value });
        }

        if (designationId.HasValue)
        {
            var exists = await dbContext.HrDesignations.AsNoTracking().AnyAsync(x => x.Id == designationId.Value && x.IsActive, cancellationToken);
            if (!exists) return new BadRequestObjectResult(new { Message = "Selected HR designation was not found or is inactive.", DesignationId = designationId.Value });
        }

        if (gradeId.HasValue)
        {
            var exists = await dbContext.HrGrades.AsNoTracking().AnyAsync(x => x.Id == gradeId.Value && x.IsActive, cancellationToken);
            if (!exists) return new BadRequestObjectResult(new { Message = "Selected HR grade was not found or is inactive.", GradeId = gradeId.Value });
        }

        return null;
    }

    private static object MapEmployee(HrEmployee x) => new
    {
        x.Id,
        x.TenantId,
        x.EmployeeNumber,
        x.FirstName,
        x.MiddleName,
        x.LastName,
        x.FullName,
        x.Email,
        x.PhoneNumber,
        x.DepartmentId,
        DepartmentCode = x.Department != null ? x.Department.Code : null,
        DepartmentName = x.Department != null ? x.Department.Name : null,
        x.DesignationId,
        DesignationCode = x.Designation != null ? x.Designation.Code : null,
        DesignationName = x.Designation != null ? x.Designation.Name : null,
        x.GradeId,
        GradeCode = x.Grade != null ? x.Grade.Code : null,
        GradeName = x.Grade != null ? x.Grade.Name : null,
        x.Gender,
        GenderName = x.Gender.ToString(),
        x.EmploymentType,
        EmploymentTypeName = x.EmploymentType.ToString(),
        x.Status,
        StatusName = x.Status.ToString(),
        x.HireDateUtc,
        x.DateOfBirthUtc,
        x.TerminatedOnUtc,
        x.TerminationReason,
        x.BankName,
        x.BankAccountNumber,
        x.PensionNumber,
        x.TaxIdentificationNumber,
        x.Address,
        x.EmergencyContactName,
        x.EmergencyContactPhone,
        x.Notes,
        x.CreatedOnUtc,
        x.CreatedBy,
        x.LastModifiedOnUtc,
        x.LastModifiedBy
    };

    [Authorize(Policy = AuthorizationPolicies.HrView)]
    [HttpGet("dashboard-summary")]
    public async Task<IActionResult> GetDashboardSummary(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var totalEmployees = await dbContext.HrEmployees.AsNoTracking().CountAsync(cancellationToken);
        var activeEmployees = await dbContext.HrEmployees.AsNoTracking().CountAsync(x => x.Status == HrEmployeeStatus.Active, cancellationToken);
        var terminatedEmployees = await dbContext.HrEmployees.AsNoTracking().CountAsync(x => x.Status == HrEmployeeStatus.Terminated, cancellationToken);
        var pendingLeaveRequests = await dbContext.HrLeaveRequests.AsNoTracking().CountAsync(x => x.Status == HrLeaveRequestStatus.SubmittedForApproval, cancellationToken);
        var approvedLeaveRequests = await dbContext.HrLeaveRequests.AsNoTracking().CountAsync(x => x.Status == HrLeaveRequestStatus.Approved, cancellationToken);
        var trainingCount = await dbContext.HrTrainingRecords.AsNoTracking().CountAsync(cancellationToken);
        var disciplinaryCount = await dbContext.HrDisciplinaryRecords.AsNoTracking().CountAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            SnapshotUtc = DateTime.UtcNow,
            TotalEmployees = totalEmployees,
            ActiveEmployees = activeEmployees,
            TerminatedEmployees = terminatedEmployees,
            PendingLeaveRequests = pendingLeaveRequests,
            ApprovedLeaveRequests = approvedLeaveRequests,
            TrainingRecordCount = trainingCount,
            DisciplinaryRecordCount = disciplinaryCount
        });
    }

    [Authorize(Policy = AuthorizationPolicies.HrView)]
    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        var items = await dbContext.HrDepartments.AsNoTracking().OrderBy(x => x.Code).ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.HrDepartmentManage)]
    [HttpPost("departments")]
    public async Task<IActionResult> CreateDepartment(
        [FromBody] SaveHrSetupItemRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { Message = "Code and name are required." });

        var code = request.Code.Trim().ToUpperInvariant();
        var exists = await dbContext.HrDepartments.AsNoTracking().AnyAsync(x => x.Code == code, cancellationToken);
        if (exists) return Conflict(new { Message = "A department with the same code already exists.", Code = code });

        var item = new HrDepartment(Guid.NewGuid(), tenantContext.TenantId, code, request.Name, request.Description, request.IsActive);
        item.SetAudit(CurrentUserName(User), CurrentUserName(User));
        dbContext.HrDepartments.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrDepartment", "Created", item.Id, item.Code, $"HR department '{item.Code}' created.", CurrentUserName(User), tenantContext.TenantId, new { item.Code, item.Name, item.IsActive }, cancellationToken);

        return Ok(new { Message = "HR department created successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.HrDepartmentManage)]
    [HttpPut("departments/{departmentId:guid}")]
    public async Task<IActionResult> UpdateDepartment(
        Guid departmentId,
        [FromBody] UpdateHrSetupItemRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });

        var item = await dbContext.HrDepartments.FirstOrDefaultAsync(x => x.Id == departmentId, cancellationToken);
        if (item is null) return NotFound(new { Message = "HR department was not found.", DepartmentId = departmentId });

        item.Update(request.Name, request.Description, request.IsActive);
        item.SetAudit(item.CreatedBy, CurrentUserName(User));
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrDepartment", "Updated", item.Id, item.Code, $"HR department '{item.Code}' updated.", CurrentUserName(User), tenantContext.TenantId, new { item.Code, item.Name, item.IsActive }, cancellationToken);

        return Ok(new { Message = "HR department updated successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.HrSetupManage)]
    [HttpGet("designations")]
    public async Task<IActionResult> GetDesignations(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        var items = await dbContext.HrDesignations.AsNoTracking().OrderBy(x => x.Code).ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.HrDesignationManage)]
    [HttpPost("designations")]
    public async Task<IActionResult> CreateDesignation(
        [FromBody] SaveHrSetupItemRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { Message = "Code and name are required." });

        var code = request.Code.Trim().ToUpperInvariant();
        var exists = await dbContext.HrDesignations.AsNoTracking().AnyAsync(x => x.Code == code, cancellationToken);
        if (exists) return Conflict(new { Message = "A designation with the same code already exists.", Code = code });

        var item = new HrDesignation(Guid.NewGuid(), tenantContext.TenantId, code, request.Name, request.Description, request.IsActive);
        item.SetAudit(CurrentUserName(User), CurrentUserName(User));
        dbContext.HrDesignations.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrDesignation", "Created", item.Id, item.Code, $"HR designation '{item.Code}' created.", CurrentUserName(User), tenantContext.TenantId, new { item.Code, item.Name, item.IsActive }, cancellationToken);

        return Ok(new { Message = "HR designation created successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.HrDesignationManage)]
    [HttpPut("designations/{designationId:guid}")]
    public async Task<IActionResult> UpdateDesignation(
        Guid designationId,
        [FromBody] UpdateHrSetupItemRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });

        var item = await dbContext.HrDesignations.FirstOrDefaultAsync(x => x.Id == designationId, cancellationToken);
        if (item is null) return NotFound(new { Message = "HR designation was not found.", DesignationId = designationId });

        item.Update(request.Name, request.Description, request.IsActive);
        item.SetAudit(item.CreatedBy, CurrentUserName(User));
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrDesignation", "Updated", item.Id, item.Code, $"HR designation '{item.Code}' updated.", CurrentUserName(User), tenantContext.TenantId, new { item.Code, item.Name, item.IsActive }, cancellationToken);

        return Ok(new { Message = "HR designation updated successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.HrSetupManage)]
    [HttpGet("grades")]
    public async Task<IActionResult> GetGrades(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        var items = await dbContext.HrGrades.AsNoTracking().OrderBy(x => x.Code).ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.HrGradeManage)]
    [HttpPost("grades")]
    public async Task<IActionResult> CreateGrade(
        [FromBody] SaveHrSetupItemRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { Message = "Code and name are required." });

        var code = request.Code.Trim().ToUpperInvariant();
        var exists = await dbContext.HrGrades.AsNoTracking().AnyAsync(x => x.Code == code, cancellationToken);
        if (exists) return Conflict(new { Message = "A grade with the same code already exists.", Code = code });

        var item = new HrGrade(Guid.NewGuid(), tenantContext.TenantId, code, request.Name, request.Description, request.IsActive);
        item.SetAudit(CurrentUserName(User), CurrentUserName(User));
        dbContext.HrGrades.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrGrade", "Created", item.Id, item.Code, $"HR grade '{item.Code}' created.", CurrentUserName(User), tenantContext.TenantId, new { item.Code, item.Name, item.IsActive }, cancellationToken);

        return Ok(new { Message = "HR grade created successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.HrGradeManage)]
    [HttpPut("grades/{gradeId:guid}")]
    public async Task<IActionResult> UpdateGrade(
        Guid gradeId,
        [FromBody] UpdateHrSetupItemRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });

        var item = await dbContext.HrGrades.FirstOrDefaultAsync(x => x.Id == gradeId, cancellationToken);
        if (item is null) return NotFound(new { Message = "HR grade was not found.", GradeId = gradeId });

        item.Update(request.Name, request.Description, request.IsActive);
        item.SetAudit(item.CreatedBy, CurrentUserName(User));
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrGrade", "Updated", item.Id, item.Code, $"HR grade '{item.Code}' updated.", CurrentUserName(User), tenantContext.TenantId, new { item.Code, item.Name, item.IsActive }, cancellationToken);

        return Ok(new { Message = "HR grade updated successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.HrView)]
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

        var items = await dbContext.HrEmployees
            .AsNoTracking()
            .Include(x => x.Department)
            .Include(x => x.Designation)
            .Include(x => x.Grade)
            .OrderBy(x => x.EmployeeNumber)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items.Select(MapEmployee).ToList()
        });
    }

    [Authorize(Policy = AuthorizationPolicies.HrEmployeeCreate)]
    [HttpPost("employees")]
    public async Task<IActionResult> CreateEmployee(
        [FromBody] SaveEmployeeRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        if (string.IsNullOrWhiteSpace(request.EmployeeNumber)) return BadRequest(new { Message = "Employee number is required." });

        var referenceValidation = await ValidateReferencesAsync(dbContext, request.DepartmentId, request.DesignationId, request.GradeId, cancellationToken);
        if (referenceValidation is not null) return referenceValidation;

        var employeeNumber = request.EmployeeNumber.Trim().ToUpperInvariant();
        var exists = await dbContext.HrEmployees.AsNoTracking().AnyAsync(x => x.EmployeeNumber == employeeNumber, cancellationToken);
        if (exists) return Conflict(new { Message = "An HR employee with the same employee number already exists.", EmployeeNumber = employeeNumber });

        var employee = new HrEmployee(
            Guid.NewGuid(),
            tenantContext.TenantId,
            employeeNumber,
            request.FirstName,
            request.MiddleName,
            request.LastName,
            request.Email,
            request.PhoneNumber,
            request.DepartmentId,
            request.DesignationId,
            request.GradeId,
            request.Gender,
            request.EmploymentType,
            request.Status,
            request.HireDateUtc,
            request.DateOfBirthUtc,
            request.BankName,
            request.BankAccountNumber,
            request.PensionNumber,
            request.TaxIdentificationNumber,
            request.Address,
            request.EmergencyContactName,
            request.EmergencyContactPhone,
            request.Notes);

        employee.SetAudit(CurrentUserName(User), CurrentUserName(User));
        dbContext.HrEmployees.Add(employee);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync("hr", "HrEmployee", "Created", employee.Id, employee.EmployeeNumber, $"HR employee '{employee.EmployeeNumber}' created.", CurrentUserName(User), tenantContext.TenantId, new { employee.EmployeeNumber, employee.FullName, employee.Status }, cancellationToken);

        return Ok(new { Message = "HR employee created successfully.", Item = MapEmployee(employee) });
    }


    [Authorize(Policy = AuthorizationPolicies.HrEmployeeCreate)]
    [HttpPost("employees/import")]
    public async Task<IActionResult> ImportEmployees(
        [FromBody] ImportHrEmployeesRequest request,
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

        if (request.Items.Count > 1000)
        {
            return BadRequest(new { Message = "Maximum import size is 1,000 employee rows per upload." });
        }

        var errors = new List<object>();
        var imported = new List<HrEmployee>();
        var seenEmployeeNumbers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var departmentLookup = await dbContext.HrDepartments
            .AsNoTracking()
            .Where(x => x.IsActive)
            .ToDictionaryAsync(x => x.Code.ToUpper(), x => x.Id, cancellationToken);

        var designationLookup = await dbContext.HrDesignations
            .AsNoTracking()
            .Where(x => x.IsActive)
            .ToDictionaryAsync(x => x.Code.ToUpper(), x => x.Id, cancellationToken);

        var gradeLookup = await dbContext.HrGrades
            .AsNoTracking()
            .Where(x => x.IsActive)
            .ToDictionaryAsync(x => x.Code.ToUpper(), x => x.Id, cancellationToken);

        var existingEmployeeNumbers = await dbContext.HrEmployees
            .AsNoTracking()
            .Select(x => x.EmployeeNumber)
            .ToListAsync(cancellationToken);

        var existing = existingEmployeeNumbers.ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var row in request.Items.Select((value, index) => new { value, index }))
        {
            var item = row.value;
            var rowNumber = row.index + 1;

            if (string.IsNullOrWhiteSpace(item.EmployeeNumber))
            {
                errors.Add(new { Row = rowNumber, Message = "Employee number is required." });
                continue;
            }

            if (string.IsNullOrWhiteSpace(item.FirstName))
            {
                errors.Add(new { Row = rowNumber, Message = "First name is required.", item.EmployeeNumber });
                continue;
            }

            if (string.IsNullOrWhiteSpace(item.LastName))
            {
                errors.Add(new { Row = rowNumber, Message = "Last name is required.", item.EmployeeNumber });
                continue;
            }

            var employeeNumber = item.EmployeeNumber.Trim().ToUpperInvariant();

            if (!seenEmployeeNumbers.Add(employeeNumber))
            {
                errors.Add(new { Row = rowNumber, Message = "Duplicate employee number inside import file.", EmployeeNumber = employeeNumber });
                continue;
            }

            if (existing.Contains(employeeNumber))
            {
                errors.Add(new { Row = rowNumber, Message = "Employee number already exists.", EmployeeNumber = employeeNumber });
                continue;
            }

            Guid? departmentId = null;
            Guid? designationId = null;
            Guid? gradeId = null;

            if (!string.IsNullOrWhiteSpace(item.DepartmentCode))
            {
                var code = item.DepartmentCode.Trim().ToUpperInvariant();
                if (!departmentLookup.TryGetValue(code, out var resolvedId))
                {
                    errors.Add(new { Row = rowNumber, Message = "Department code was not found or is inactive.", EmployeeNumber = employeeNumber, DepartmentCode = code });
                    continue;
                }

                departmentId = resolvedId;
            }

            if (!string.IsNullOrWhiteSpace(item.DesignationCode))
            {
                var code = item.DesignationCode.Trim().ToUpperInvariant();
                if (!designationLookup.TryGetValue(code, out var resolvedId))
                {
                    errors.Add(new { Row = rowNumber, Message = "Designation code was not found or is inactive.", EmployeeNumber = employeeNumber, DesignationCode = code });
                    continue;
                }

                designationId = resolvedId;
            }

            if (!string.IsNullOrWhiteSpace(item.GradeCode))
            {
                var code = item.GradeCode.Trim().ToUpperInvariant();
                if (!gradeLookup.TryGetValue(code, out var resolvedId))
                {
                    errors.Add(new { Row = rowNumber, Message = "Grade code was not found or is inactive.", EmployeeNumber = employeeNumber, GradeCode = code });
                    continue;
                }

                gradeId = resolvedId;
            }

            try
            {
                var employee = new HrEmployee(
                    Guid.NewGuid(),
                    tenantContext.TenantId,
                    employeeNumber,
                    item.FirstName,
                    item.MiddleName,
                    item.LastName,
                    item.Email,
                    item.PhoneNumber,
                    departmentId,
                    designationId,
                    gradeId,
                    item.Gender,
                    item.EmploymentType,
                    item.Status,
                    item.HireDateUtc,
                    item.DateOfBirthUtc,
                    item.BankName,
                    item.BankAccountNumber,
                    item.PensionNumber,
                    item.TaxIdentificationNumber,
                    item.Address,
                    item.EmergencyContactName,
                    item.EmergencyContactPhone,
                    item.Notes);

                employee.SetAudit(CurrentUserName(User), CurrentUserName(User));
                imported.Add(employee);
            }
            catch (ArgumentException ex)
            {
                errors.Add(new { Row = rowNumber, Message = ex.Message, EmployeeNumber = employeeNumber });
            }
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

        dbContext.HrEmployees.AddRange(imported);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "hr",
            "HrEmployee",
            "Imported",
            null,
            "employee-import",
            $"Imported {imported.Count} HR employee(s).",
            CurrentUserName(User),
            tenantContext.TenantId,
            new { Count = imported.Count },
            cancellationToken);

        return Ok(new
        {
            Message = "HR employees imported successfully.",
            Count = imported.Count,
            Items = imported.Select(MapEmployee).ToList()
        });
    }

    [Authorize(Policy = AuthorizationPolicies.HrEmployeeUpdate)]
    [HttpPut("employees/{employeeId:guid}")]
    public async Task<IActionResult> UpdateEmployee(
        Guid employeeId,
        [FromBody] SaveEmployeeRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });

        var employee = await dbContext.HrEmployees
            .Include(x => x.Department)
            .Include(x => x.Designation)
            .Include(x => x.Grade)
            .FirstOrDefaultAsync(x => x.Id == employeeId, cancellationToken);

        if (employee is null) return NotFound(new { Message = "HR employee was not found.", EmployeeId = employeeId });

        var referenceValidation = await ValidateReferencesAsync(dbContext, request.DepartmentId, request.DesignationId, request.GradeId, cancellationToken);
        if (referenceValidation is not null) return referenceValidation;

        employee.Update(
            request.FirstName,
            request.MiddleName,
            request.LastName,
            request.Email,
            request.PhoneNumber,
            request.DepartmentId,
            request.DesignationId,
            request.GradeId,
            request.Gender,
            request.EmploymentType,
            request.Status,
            request.HireDateUtc,
            request.DateOfBirthUtc,
            request.BankName,
            request.BankAccountNumber,
            request.PensionNumber,
            request.TaxIdentificationNumber,
            request.Address,
            request.EmergencyContactName,
            request.EmergencyContactPhone,
            request.Notes);

        employee.SetAudit(employee.CreatedBy, CurrentUserName(User));
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrEmployee", "Updated", employee.Id, employee.EmployeeNumber, $"HR employee '{employee.EmployeeNumber}' updated.", CurrentUserName(User), tenantContext.TenantId, new { employee.EmployeeNumber, employee.FullName, employee.Status }, cancellationToken);

        return Ok(new { Message = "HR employee updated successfully.", Item = MapEmployee(employee) });
    }

    [Authorize(Policy = AuthorizationPolicies.HrEmployeeTerminate)]
    [HttpPost("employees/{employeeId:guid}/terminate")]
    public async Task<IActionResult> TerminateEmployee(
        Guid employeeId,
        [FromBody] TerminateEmployeeRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { Message = "Termination reason is required." });

        var employee = await dbContext.HrEmployees.FirstOrDefaultAsync(x => x.Id == employeeId, cancellationToken);
        if (employee is null) return NotFound(new { Message = "HR employee was not found.", EmployeeId = employeeId });

        employee.Terminate(request.TerminatedOnUtc, request.Reason);
        employee.SetAudit(employee.CreatedBy, CurrentUserName(User));
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrEmployee", "Terminated", employee.Id, employee.EmployeeNumber, $"HR employee '{employee.EmployeeNumber}' terminated.", CurrentUserName(User), tenantContext.TenantId, new { employee.EmployeeNumber, employee.TerminatedOnUtc, employee.TerminationReason }, cancellationToken);

        return Ok(new { Message = "HR employee terminated successfully.", Item = MapEmployee(employee) });
    }

    [Authorize(Policy = AuthorizationPolicies.HrLeaveCreate)]
    [HttpPost("leave-requests")]
    public async Task<IActionResult> CreateLeaveRequest(
        [FromBody] SaveLeaveRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });

        var employeeExists = await dbContext.HrEmployees.AsNoTracking().AnyAsync(x => x.Id == request.EmployeeId && x.Status != HrEmployeeStatus.Terminated, cancellationToken);
        if (!employeeExists) return BadRequest(new { Message = "Selected employee was not found or is terminated.", request.EmployeeId });

        var item = new HrLeaveRequest(Guid.NewGuid(), tenantContext.TenantId, request.EmployeeId, request.StartDateUtc, request.EndDateUtc, request.LeaveType, request.Reason);
        item.SetAudit(CurrentUserName(User), CurrentUserName(User));
        dbContext.HrLeaveRequests.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrLeaveRequest", "Created", item.Id, item.LeaveType, "HR leave request created.", CurrentUserName(User), tenantContext.TenantId, new { item.EmployeeId, item.StartDateUtc, item.EndDateUtc, item.Status }, cancellationToken);
        return Ok(new { Message = "Leave request created successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.HrLeaveView)]
    [HttpGet("leave-requests")]
    public async Task<IActionResult> GetLeaveRequests(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        var items = await dbContext.HrLeaveRequests
            .AsNoTracking()
            .Include(x => x.Employee)
            .OrderByDescending(x => x.CreatedOnUtc)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.EmployeeId,
                EmployeeNumber = x.Employee != null ? x.Employee.EmployeeNumber : string.Empty,
                EmployeeName = x.Employee != null ? x.Employee.FullName : string.Empty,
                x.StartDateUtc,
                x.EndDateUtc,
                x.LeaveType,
                x.Reason,
                x.Status,
                StatusName = x.Status.ToString(),
                x.SubmittedBy,
                x.SubmittedOnUtc,
                x.ApprovedBy,
                x.ApprovedOnUtc,
                x.RejectedBy,
                x.RejectedOnUtc,
                x.RejectionReason,
                x.CancelledOnUtc,
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

    [Authorize(Policy = AuthorizationPolicies.HrLeaveCreate)]
    [HttpPost("leave-requests/{leaveRequestId:guid}/submit")]
    public async Task<IActionResult> SubmitLeaveRequest(Guid leaveRequestId, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, [FromServices] IAuditTrailWriter auditTrailWriter, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        var item = await dbContext.HrLeaveRequests.FirstOrDefaultAsync(x => x.Id == leaveRequestId, cancellationToken);
        if (item is null) return NotFound(new { Message = "Leave request was not found.", LeaveRequestId = leaveRequestId });
        try { item.Submit(CurrentUserName(User)); item.SetAudit(item.CreatedBy, CurrentUserName(User)); }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException) { return BadRequest(new { Message = ex.Message }); }
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrLeaveRequest", "Submitted", item.Id, item.LeaveType, "HR leave request submitted.", CurrentUserName(User), tenantContext.TenantId, new { item.Status }, cancellationToken);
        return Ok(new { Message = "Leave request submitted successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.HrLeaveApprove)]
    [HttpPost("leave-requests/{leaveRequestId:guid}/approve")]
    public async Task<IActionResult> ApproveLeaveRequest(Guid leaveRequestId, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, [FromServices] IAuditTrailWriter auditTrailWriter, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        var item = await dbContext.HrLeaveRequests.FirstOrDefaultAsync(x => x.Id == leaveRequestId, cancellationToken);
        if (item is null) return NotFound(new { Message = "Leave request was not found.", LeaveRequestId = leaveRequestId });
        try { item.Approve(CurrentUserName(User)); item.SetAudit(item.CreatedBy, CurrentUserName(User)); }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException) { return BadRequest(new { Message = ex.Message }); }
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrLeaveRequest", "Approved", item.Id, item.LeaveType, "HR leave request approved.", CurrentUserName(User), tenantContext.TenantId, new { item.Status }, cancellationToken);
        return Ok(new { Message = "Leave request approved successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.HrLeaveReject)]
    [HttpPost("leave-requests/{leaveRequestId:guid}/reject")]
    public async Task<IActionResult> RejectLeaveRequest(Guid leaveRequestId, [FromBody] RejectRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, [FromServices] IAuditTrailWriter auditTrailWriter, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { Message = "Reason for rejection is required." });
        var item = await dbContext.HrLeaveRequests.FirstOrDefaultAsync(x => x.Id == leaveRequestId, cancellationToken);
        if (item is null) return NotFound(new { Message = "Leave request was not found.", LeaveRequestId = leaveRequestId });
        try { item.Reject(CurrentUserName(User), request.Reason); item.SetAudit(item.CreatedBy, CurrentUserName(User)); }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException) { return BadRequest(new { Message = ex.Message }); }
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrLeaveRequest", "Rejected", item.Id, item.LeaveType, "HR leave request rejected.", CurrentUserName(User), tenantContext.TenantId, new { item.Status, item.RejectionReason }, cancellationToken);
        return Ok(new { Message = "Leave request rejected successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.HrTrainingManage)]
    [HttpGet("training-records")]
    public async Task<IActionResult> GetTrainingRecords([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        var items = await dbContext.HrTrainingRecords.AsNoTracking().Include(x => x.Employee).OrderByDescending(x => x.TrainingDateUtc).Select(x => new { x.Id, x.TenantId, x.EmployeeId, EmployeeNumber = x.Employee != null ? x.Employee.EmployeeNumber : string.Empty, EmployeeName = x.Employee != null ? x.Employee.FullName : string.Empty, x.TrainingTitle, x.Provider, x.TrainingDateUtc, x.CostAmount, x.Notes, x.CreatedOnUtc }).ToListAsync(cancellationToken);
        return Ok(new { TenantContextAvailable = tenantContext.IsAvailable, TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null, TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null, Count = items.Count, Items = items });
    }

    [Authorize(Policy = AuthorizationPolicies.HrTrainingManage)]
    [HttpPost("training-records")]
    public async Task<IActionResult> CreateTrainingRecord([FromBody] SaveTrainingRecordRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, [FromServices] IAuditTrailWriter auditTrailWriter, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        var employeeExists = await dbContext.HrEmployees.AsNoTracking().AnyAsync(x => x.Id == request.EmployeeId, cancellationToken);
        if (!employeeExists) return BadRequest(new { Message = "Selected employee was not found.", request.EmployeeId });
        var item = new HrTrainingRecord(Guid.NewGuid(), tenantContext.TenantId, request.EmployeeId, request.TrainingTitle, request.Provider, request.TrainingDateUtc, request.CostAmount, request.Notes);
        item.SetAudit(CurrentUserName(User), CurrentUserName(User));
        dbContext.HrTrainingRecords.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrTrainingRecord", "Created", item.Id, item.TrainingTitle, "HR training record created.", CurrentUserName(User), tenantContext.TenantId, new { item.EmployeeId, item.TrainingTitle, item.CostAmount }, cancellationToken);
        return Ok(new { Message = "Training record created successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.HrDisciplinaryManage)]
    [HttpGet("disciplinary-records")]
    public async Task<IActionResult> GetDisciplinaryRecords([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        var items = await dbContext.HrDisciplinaryRecords.AsNoTracking().Include(x => x.Employee).OrderByDescending(x => x.IncidentDateUtc).Select(x => new { x.Id, x.TenantId, x.EmployeeId, EmployeeNumber = x.Employee != null ? x.Employee.EmployeeNumber : string.Empty, EmployeeName = x.Employee != null ? x.Employee.FullName : string.Empty, x.IncidentDateUtc, x.Category, x.Description, x.ActionTaken, x.Notes, x.CreatedOnUtc }).ToListAsync(cancellationToken);
        return Ok(new { TenantContextAvailable = tenantContext.IsAvailable, TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null, TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null, Count = items.Count, Items = items });
    }

    [Authorize(Policy = AuthorizationPolicies.HrDisciplinaryManage)]
    [HttpPost("disciplinary-records")]
    public async Task<IActionResult> CreateDisciplinaryRecord([FromBody] SaveDisciplinaryRecordRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, [FromServices] IAuditTrailWriter auditTrailWriter, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        var employeeExists = await dbContext.HrEmployees.AsNoTracking().AnyAsync(x => x.Id == request.EmployeeId, cancellationToken);
        if (!employeeExists) return BadRequest(new { Message = "Selected employee was not found.", request.EmployeeId });
        var item = new HrDisciplinaryRecord(Guid.NewGuid(), tenantContext.TenantId, request.EmployeeId, request.IncidentDateUtc, request.Category, request.Description, request.ActionTaken, request.Notes);
        item.SetAudit(CurrentUserName(User), CurrentUserName(User));
        dbContext.HrDisciplinaryRecords.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailWriter.WriteAsync("hr", "HrDisciplinaryRecord", "Created", item.Id, item.Category, "HR disciplinary record created.", CurrentUserName(User), tenantContext.TenantId, new { item.EmployeeId, item.Category }, cancellationToken);
        return Ok(new { Message = "Disciplinary record created successfully.", Item = item });
    }

    public sealed record ImportHrEmployeesRequest(IReadOnlyCollection<ImportHrEmployeeRow> Items);

    public sealed record ImportHrEmployeeRow(
        string EmployeeNumber,
        string FirstName,
        string? MiddleName,
        string LastName,
        string? Email,
        string? PhoneNumber,
        string? DepartmentCode,
        string? DesignationCode,
        string? GradeCode,
        HrGender Gender,
        HrEmploymentType EmploymentType,
        HrEmployeeStatus Status,
        DateTime HireDateUtc,
        DateTime? DateOfBirthUtc,
        string? BankName,
        string? BankAccountNumber,
        string? PensionNumber,
        string? TaxIdentificationNumber,
        string? Address,
        string? EmergencyContactName,
        string? EmergencyContactPhone,
        string? Notes);

    public sealed record SaveHrSetupItemRequest(string Code, string Name, string? Description, bool IsActive);
    public sealed record UpdateHrSetupItemRequest(string Name, string? Description, bool IsActive);

    public sealed record SaveEmployeeRequest(
        string EmployeeNumber,
        string FirstName,
        string? MiddleName,
        string LastName,
        string? Email,
        string? PhoneNumber,
        Guid? DepartmentId,
        Guid? DesignationId,
        Guid? GradeId,
        HrGender Gender,
        HrEmploymentType EmploymentType,
        HrEmployeeStatus Status,
        DateTime HireDateUtc,
        DateTime? DateOfBirthUtc,
        string? BankName,
        string? BankAccountNumber,
        string? PensionNumber,
        string? TaxIdentificationNumber,
        string? Address,
        string? EmergencyContactName,
        string? EmergencyContactPhone,
        string? Notes);

    public sealed record TerminateEmployeeRequest(DateTime TerminatedOnUtc, string Reason);
    public sealed record SaveLeaveRequest(Guid EmployeeId, DateTime StartDateUtc, DateTime EndDateUtc, string LeaveType, string Reason);
    public sealed record RejectRequest(string Reason);
    public sealed record SaveTrainingRecordRequest(Guid EmployeeId, string TrainingTitle, string Provider, DateTime TrainingDateUtc, decimal CostAmount, string? Notes);
    public sealed record SaveDisciplinaryRecordRequest(Guid EmployeeId, DateTime IncidentDateUtc, string Category, string Description, string ActionTaken, string? Notes);
}
