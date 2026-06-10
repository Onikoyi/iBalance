using iBalance.Api.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.OilAndGas.Domain.Enums;
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


        var oilGasProductionEntries = await dbContext.OilGasProductionEntries
            .AsNoTracking()
            .Include(x => x.Asset)
            .Include(x => x.Location)
            .OrderByDescending(x => x.SubmittedOnUtc ?? x.CreatedOnUtc)
            .Take(500)
            .ToListAsync(cancellationToken);

        items.AddRange(oilGasProductionEntries
            .Where(x => x.Status is OilGasProductionStatus.Submitted or OilGasProductionStatus.Rejected)
            .Where(x => ShouldInclude(x.Status.ToString(), normalizedState))
            .Select(x => new ApprovalInboxItemDto(
                x.Id,
                "oilgas",
                "Daily Production Entry",
                x.EntryNumber,
                x.Status.ToString(),
                x.SubmittedOnUtc ?? x.RejectedOnUtc ?? x.CreatedOnUtc,
                x.RejectionReason,
                x.Status == OilGasProductionStatus.Rejected
                    ? "/oil-gas/production/rejected"
                    : "/oil-gas/production",
                null,
                null,
                null,
                $"{x.Asset?.Name ?? "Oil & Gas Asset"} / {x.Location?.Name ?? "Operational Location"}",
                "Review the production entry in Oil & Gas Operations.")));

        var oilGasStockMovements = await dbContext.OilGasStockMovements
            .AsNoTracking()
            .Include(x => x.Asset)
            .Include(x => x.Product)
            .OrderByDescending(x => x.SubmittedOnUtc ?? x.CreatedOnUtc)
            .Take(500)
            .ToListAsync(cancellationToken);

        items.AddRange(oilGasStockMovements
            .Where(x => x.Status is OilGasStockMovementStatus.Submitted or OilGasStockMovementStatus.Rejected)
            .Where(x => ShouldInclude(x.Status.ToString(), normalizedState))
            .Select(x => new ApprovalInboxItemDto(
                x.Id, "oilgas", "Oil & Gas Stock Movement", x.MovementNumber, x.Status.ToString(),
                x.SubmittedOnUtc ?? x.RejectedOnUtc ?? x.CreatedOnUtc, x.RejectionReason,
                x.Status == OilGasStockMovementStatus.Rejected ? "/oil-gas/stock/rejected" : "/oil-gas/stock",
                null, null, null,
                $"{x.Asset?.Name ?? "Oil & Gas Asset"} / {x.Product?.Name ?? "Product"} / {x.Quantity:N4} {x.UnitOfMeasure}",
                "Review the stock movement in Oil & Gas Stock Operations.")));


        var upstreamLiftings = await dbContext.OilGasLiftings
            .AsNoTracking()
            .Include(x => x.Asset)
            .Include(x => x.Product)
            .OrderByDescending(x => x.SubmittedOnUtc ?? x.CreatedOnUtc)
            .Take(500)
            .ToListAsync(cancellationToken);

        items.AddRange(upstreamLiftings
            .Where(x => x.Status is OilGasLiftingStatus.Submitted or OilGasLiftingStatus.Rejected)
            .Where(x => ShouldInclude(x.Status.ToString(), normalizedState))
            .Select(x => new ApprovalInboxItemDto(
                x.Id,
                "oilgas",
                "Upstream Lifting",
                x.LiftingNumber,
                x.Status.ToString(),
                x.SubmittedOnUtc ?? x.RejectedOnUtc ?? x.CreatedOnUtc,
                x.RejectionReason,
                "/oil-gas/upstream/liftings",
                null,
                null,
                null,
                $"{x.Asset?.Name ?? "Oil & Gas Asset"} / {x.Product?.Name ?? "Product"} / {x.ActualLoadedQuantity:N4}",
                "Review the lifting in Oil & Gas Upstream Operations.")));

        var upstreamAfes = await dbContext.OilGasAfes
            .AsNoTracking()
            .Include(x => x.Asset)
            .OrderByDescending(x => x.SubmittedOnUtc ?? x.CreatedOnUtc)
            .Take(500)
            .ToListAsync(cancellationToken);

        items.AddRange(upstreamAfes
            .Where(x => x.Status is OilGasAfeStatus.Submitted or OilGasAfeStatus.Rejected)
            .Where(x => ShouldInclude(x.Status.ToString(), normalizedState))
            .Select(x => new ApprovalInboxItemDto(
                x.Id,
                "oilgas",
                "Authorisation for Expenditure",
                x.AfeNumber,
                x.Status.ToString(),
                x.SubmittedOnUtc ?? x.RejectedOnUtc ?? x.CreatedOnUtc,
                x.RejectionReason,
                "/oil-gas/upstream/afe",
                null,
                null,
                x.RevisedAmount > 0 ? x.RevisedAmount : x.ApprovedAmount,
                $"{x.Asset?.Name ?? "Oil & Gas Asset"} / {x.Title}",
                "Review the AFE in Oil & Gas Upstream Operations.")));

        var productionPeriods = await dbContext.OilGasProductionPeriods
            .AsNoTracking()
            .OrderByDescending(x => x.SubmittedOnUtc ?? x.CreatedOnUtc)
            .Take(500)
            .ToListAsync(cancellationToken);

        items.AddRange(productionPeriods
            .Where(x => x.Status is OilGasProductionPeriodStatus.Submitted or OilGasProductionPeriodStatus.Rejected)
            .Where(x => ShouldInclude(x.Status.ToString(), normalizedState))
            .Select(x => new ApprovalInboxItemDto(
                x.Id,
                "oilgas",
                "Monthly Production Close",
                x.PeriodCode,
                x.Status.ToString(),
                x.SubmittedOnUtc ?? x.RejectedOnUtc ?? x.CreatedOnUtc,
                x.RejectionReason,
                "/oil-gas/upstream/production-close",
                null,
                null,
                null,
                $"{x.PeriodCode} / {x.StartDateUtc:MMM yyyy}",
                "Review the monthly production close in Oil & Gas Upstream Operations.")));

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
