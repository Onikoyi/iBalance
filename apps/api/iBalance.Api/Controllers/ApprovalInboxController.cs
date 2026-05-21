using iBalance.Api.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/approval-inbox")]
public sealed class ApprovalInboxController : ControllerBase
{
    [Authorize(Policy = AuthorizationPolicies.ApprovalInboxView)]
    [HttpGet("items")]
    public async Task<IActionResult> GetItems(
        [FromQuery] string? state,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var normalizedState = string.IsNullOrWhiteSpace(state) ? "all" : state.Trim().ToLowerInvariant();
        var items = new List<ApprovalInboxItemDto>();

        var hrLeaveRequests = await dbContext.HrLeaveRequests
            .AsNoTracking()
            .Include(x => x.Employee)
            .OrderByDescending(x => x.CreatedOnUtc)
            .Take(500)
            .ToListAsync(cancellationToken);

        items.AddRange(hrLeaveRequests
            .Where(x => ShouldInclude(x.Status.ToString(), normalizedState))
            .Select(x => new ApprovalInboxItemDto(
                x.Id,
                "hr",
                "HR Leave Request",
                x.Employee != null ? $"{x.Employee.EmployeeNumber} - {x.Employee.FullName}" : "Employee leave request",
                x.Status.ToString(),
                x.SubmittedOnUtc ?? x.CreatedOnUtc,
                x.RejectionReason,
                "/hr/leave",
                x.EmployeeId,
                x.Employee != null ? x.Employee.EmployeeNumber : null,
                null,
                x.LeaveType,
                "Review employee leave request in HR Leave Management.")));

        var salesCreditNotes = await dbContext.SalesCreditNotes
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedOnUtc)
            .Take(500)
            .ToListAsync(cancellationToken);

        items.AddRange(salesCreditNotes
            .Where(x => ShouldInclude(x.Status.ToString(), normalizedState))
            .Select(x => new ApprovalInboxItemDto(
                x.Id,
                "billing",
                "Billing Credit Note",
                x.CreditNoteNumber,
                x.Status.ToString(),
                x.SubmittedOnUtc ?? x.CreatedOnUtc,
                x.RejectionReason,
                x.Status.ToString().Equals("Rejected", StringComparison.OrdinalIgnoreCase)
                    ? "/billing/credit-notes/rejected"
                    : "/billing/credit-notes",
                null,
                null,
                x.Amount,
                x.Description,
                "Review billing credit note in Billing & Invoicing.")));

        var payrollRuns = await dbContext.PayrollRuns
            .AsNoTracking()
            .OrderByDescending(x => x.RunDateUtc)
            .Take(500)
            .ToListAsync(cancellationToken);

        items.AddRange(payrollRuns
            .Where(x => ShouldIncludePayrollRun(x.Status, normalizedState))
            .Select(x => new ApprovalInboxItemDto(
                x.Id,
                "payroll",
                "Payroll Run",
                x.PayrollPeriod,
                ResolvePayrollStatusName(x.Status),
                x.RunDateUtc,
                null,
                x.Status == 3 ? "/payroll/runs/rejected" : "/payroll/runs",
                null,
                null,
                null,
                $"Payroll period {x.PayrollPeriod}",
                "Review payroll run in Payroll Runs.")));

        var journalEntries = await dbContext.JournalEntries
            .AsNoTracking()
            .OrderByDescending(x => x.EntryDateUtc)
            .Take(500)
            .ToListAsync(cancellationToken);

        items.AddRange(journalEntries
            .Where(x => ShouldInclude(x.Status.ToString(), normalizedState))
            .Select(x => new ApprovalInboxItemDto(
                x.Id,
                "finance",
                "Journal Entry",
                x.Reference,
                x.Status.ToString(),
                x.EntryDateUtc,
                null,
                "/finance",
                null,
                null,
                null,
                x.Description,
                "Review journal entry in Finance / General Ledger.")));

        var ordered = items
            .OrderByDescending(x => x.RequestedOnUtc)
            .ToList();

        return Ok(new ApprovalInboxResponse(
            true,
            tenantContext.TenantId,
            tenantContext.TenantKey,
            DateTime.UtcNow,
            ordered.Count,
            ordered.Count(x => IsPendingStatus(x.Status)),
            ordered.Count(x => IsRejectedStatus(x.Status)),
            ordered));
    }

    private static bool ShouldInclude(string status, string state)
    {
        if (state == "all")
        {
            return IsPendingStatus(status) || IsRejectedStatus(status);
        }

        if (state == "pending")
        {
            return IsPendingStatus(status);
        }

        if (state == "rejected")
        {
            return IsRejectedStatus(status);
        }

        return IsPendingStatus(status) || IsRejectedStatus(status);
    }

    private static bool ShouldIncludePayrollRun(int status, string state)
    {
        var statusName = ResolvePayrollStatusName(status);
        return ShouldInclude(statusName, state);
    }

    private static bool IsPendingStatus(string status)
    {
        return status.Equals("SubmittedForApproval", StringComparison.OrdinalIgnoreCase) ||
               status.Equals("Submitted", StringComparison.OrdinalIgnoreCase) ||
               status.Equals("Processed", StringComparison.OrdinalIgnoreCase) ||
               status.Equals("PendingApproval", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsRejectedStatus(string status)
    {
        return status.Equals("Rejected", StringComparison.OrdinalIgnoreCase);
    }

    private static string ResolvePayrollStatusName(int status) =>
        status switch
        {
            0 => "Draft",
            1 => "Submitted",
            2 => "Posted",
            3 => "Rejected",
            _ => $"Status {status}"
        };

    public sealed record ApprovalInboxResponse(
        bool TenantContextAvailable,
        Guid TenantId,
        string TenantKey,
        DateTime SnapshotUtc,
        int Count,
        int PendingCount,
        int RejectedCount,
        IReadOnlyCollection<ApprovalInboxItemDto> Items);

    public sealed record ApprovalInboxItemDto(
        Guid Id,
        string Module,
        string ItemType,
        string Reference,
        string Status,
        DateTime RequestedOnUtc,
        string? RejectionReason,
        string Route,
        Guid? EmployeeId,
        string? EmployeeNumber,
        decimal? Amount,
        string? Description,
        string ActionHint);
}
