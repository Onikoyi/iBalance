using System.Globalization;
using System.Text;
using iBalance.BuildingBlocks.Application.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Finance.Domain.Entities;
using iBalance.Modules.Finance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using iBalance.Api.Security;
using iBalance.Api.Services.Audit;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/finance/budgets")]
public sealed class BudgetsController : ControllerBase

{

[Authorize(Policy = AuthorizationPolicies.BudgetView)]
[HttpGet]
public async Task<IActionResult> GetBudgets(
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
    CancellationToken cancellationToken)
{
    var tenantContext = tenantContextAccessor.Current;

    if (!tenantContext.IsAvailable)
    {
        return BadRequest(new
        {
            Message = "Tenant context is required.",
            RequiredHeader = "X-Tenant-Key"
        });
    }

    var budgets = await dbContext.Budgets
        .AsNoTracking()
        .Include(x => x.Lines)
        .Where(x => x.Status != BudgetStatus.Rejected)
        .OrderByDescending(x => x.PeriodStartUtc)
        .ThenBy(x => x.BudgetNumber)
        .ToListAsync(cancellationToken);

    var userNames = await GetUserDisplayNamesAsync(
        dbContext,
        budgets.SelectMany(x => new[]
        {
            x.SubmittedBy,
            x.ApprovedBy,
            x.RejectedBy,
            x.LockedBy,
            x.ClosedBy
        }),
        cancellationToken);

    var items = budgets
        .Select(x => ProjectBudgetSummary(x, userNames))
        .ToList();

    return Ok(new
    {
        TenantContextAvailable = true,
        TenantId = tenantContext.TenantId,
        TenantKey = tenantContext.TenantKey,
        Count = items.Count,
        Items = items
    });
}

    [Authorize(Policy = AuthorizationPolicies.BudgetView)]
    [HttpGet("rejected")]
    public async Task<IActionResult> GetRejectedBudgets(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var budgets = await dbContext.Budgets
            .AsNoTracking()
            .Include(x => x.Lines)
                .ThenInclude(x => x.LedgerAccount)
            .Where(x => x.Status == BudgetStatus.Rejected)
            .OrderByDescending(x => x.RejectedOnUtc)
            .ThenBy(x => x.BudgetNumber)
            .ToListAsync(cancellationToken);

        var userNames = await GetUserDisplayNamesAsync(
            dbContext,
            budgets.SelectMany(x => new[]
            {
                x.SubmittedBy,
                x.ApprovedBy,
                x.RejectedBy,
                x.LockedBy,
                x.ClosedBy
            }),
            cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = budgets.Count,
            Items = budgets.Select(x => ProjectBudgetDetail(x, userNames))
        });
    }


    

[Authorize(Policy = AuthorizationPolicies.BudgetView)]
[HttpGet("{budgetId:guid}")]
public async Task<IActionResult> GetBudgetDetail(
    Guid budgetId,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
    CancellationToken cancellationToken)
{
    var tenantContext = tenantContextAccessor.Current;

    if (!tenantContext.IsAvailable)
    {
        return BadRequest(new
        {
            Message = "Tenant context is required.",
            RequiredHeader = "X-Tenant-Key"
        });
    }

    var budget = await dbContext.Budgets
        .AsNoTracking()
        .Include(x => x.Lines)
            .ThenInclude(x => x.LedgerAccount)
        .FirstOrDefaultAsync(x => x.Id == budgetId, cancellationToken);

    if (budget is null)
    {
        return NotFound(new
        {
            Message = "Budget was not found.",
            BudgetId = budgetId
        });
    }

    var transfers = await dbContext.BudgetTransfers
        .AsNoTracking()
        .Where(x => x.BudgetId == budgetId)
        .OrderByDescending(x => x.TransferredOnUtc)
        .ToListAsync(cancellationToken);

    var userNames = await GetUserDisplayNamesAsync(
        dbContext,
        new[]
        {
            budget.SubmittedBy,
            budget.ApprovedBy,
            budget.RejectedBy,
            budget.LockedBy,
            budget.ClosedBy
        }.Concat(transfers.Select(x => x.TransferredBy)),
        cancellationToken);

    return Ok(new
    {
        TenantContextAvailable = true,
        TenantId = tenantContext.TenantId,
        TenantKey = tenantContext.TenantKey,
        Budget = ProjectBudgetDetail(budget, userNames),
        Transfers = transfers.Select(x => new
        {
            x.Id,
            x.BudgetId,
            x.FromBudgetLineId,
            x.ToBudgetLineId,
            x.Amount,
            x.Reason,
            x.TransferredBy,
            TransferredByDisplayName = ResolveUserDisplayName(x.TransferredBy, userNames),
            x.TransferredOnUtc
        }).ToList()
    });
}

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.BudgetCreate)]
    public async Task<IActionResult> CreateBudget(
        [FromBody] CreateBudgetRequest request,
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

        var validation = await ValidateBudgetRequestAsync(dbContext, tenantContext.TenantId, null, request, cancellationToken);
        if (validation is not null) return validation;

        var budget = new Budget(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.BudgetNumber,
            request.Name,
            request.Description,
            request.Type,
            request.PeriodStartUtc,
            request.PeriodEndUtc,
            request.Notes);

        budget.SetOverrunPolicy(request.OverrunPolicy ?? BudgetOverrunPolicy.WarnOnly);

        foreach (var line in request.Lines)
        {
            budget.AddLine(new BudgetLine(
                Guid.NewGuid(),
                tenantContext.TenantId,
                budget.Id,
                line.LedgerAccountId,
                line.PeriodStartUtc,
                line.PeriodEndUtc,
                line.BudgetAmount,
                line.Notes));
        }

        dbContext.Budgets.Add(budget);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "budget",
            "Budget",
            "Created",
            budget.Id,
            budget.BudgetNumber,
            $"Budget '{budget.BudgetNumber}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                budget.BudgetNumber,
                budget.Name,
                budget.Type,
                budget.PeriodStartUtc,
                budget.PeriodEndUtc,
                budget.OverrunPolicy,
                LineCount = budget.Lines.Count
            },
            cancellationToken);

        return Ok(new
        {
            Message = "Budget created successfully.",
            Budget = ProjectBudgetSummary(budget)
        });
    }

    [HttpPut("{budgetId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.BudgetManage)]
    public async Task<IActionResult> UpdateBudget(
        Guid budgetId,
        [FromBody] CreateBudgetRequest request,
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

        var budget = await dbContext.Budgets
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == budgetId, cancellationToken);

        if (budget is null)
        {
            return NotFound(new { Message = "Budget was not found.", BudgetId = budgetId });
        }

        if (budget.Status != BudgetStatus.Draft && budget.Status != BudgetStatus.Rejected)
        {
            return Conflict(new { Message = "Only draft or rejected budgets can be edited.", budget.Status });
        }

        var validation = await ValidateBudgetRequestAsync(dbContext, tenantContext.TenantId, budgetId, request, cancellationToken);
        if (validation is not null) return validation;

        budget.UpdateHeader(
            request.BudgetNumber,
            request.Name,
            request.Description,
            request.Type,
            request.PeriodStartUtc,
            request.PeriodEndUtc,
            request.Notes);

        budget.SetOverrunPolicy(request.OverrunPolicy ?? budget.OverrunPolicy);

        var existingLines = budget.Lines.ToList();

var submittedExistingLineIds = request.Lines
    .Where(x => x.Id.HasValue && x.Id.Value != Guid.Empty)
    .Select(x => x.Id!.Value)
    .ToHashSet();

foreach (var existingLine in existingLines)
{
    var wasRemoved = !submittedExistingLineIds.Contains(existingLine.Id);

    if (wasRemoved)
    {
        var hasMovement = await BudgetLineHasPostedActualMovementAsync(
            dbContext,
            existingLine,
            cancellationToken);

        if (hasMovement)
        {
            return Conflict(new
            {
                Message = "This budget line cannot be deleted because it has posted actual movements.",
                BudgetLineId = existingLine.Id,
                existingLine.LedgerAccountId,
                existingLine.PeriodStartUtc,
                existingLine.PeriodEndUtc,
                existingLine.BudgetAmount
            });
        }
    }
}

foreach (var requestedLine in request.Lines)
{
    if (!requestedLine.Id.HasValue || requestedLine.Id.Value == Guid.Empty)
    {
        continue;
    }

    var existingLine = existingLines.FirstOrDefault(x => x.Id == requestedLine.Id.Value);

    if (existingLine is null)
    {
        return BadRequest(new
        {
            Message = "One or more submitted budget line ids do not belong to the selected budget.",
            requestedLine.Id
        });
    }

    var hasMovement = await BudgetLineHasPostedActualMovementAsync(
        dbContext,
        existingLine,
        cancellationToken);

    if (hasMovement &&
        (existingLine.LedgerAccountId != requestedLine.LedgerAccountId ||
         existingLine.PeriodStartUtc != requestedLine.PeriodStartUtc ||
         existingLine.PeriodEndUtc != requestedLine.PeriodEndUtc))
    {
        return Conflict(new
        {
            Message = "This budget line has posted actual movements, so its ledger account and period cannot be changed. Adjust the amount or create a budget transfer instead.",
            BudgetLineId = existingLine.Id
        });
    }
}

if (existingLines.Count > 0)
{
    dbContext.BudgetLines.RemoveRange(existingLines);
}

foreach (var line in request.Lines)
{
    var budgetLine = new BudgetLine(
        line.Id.HasValue && line.Id.Value != Guid.Empty ? line.Id.Value : Guid.NewGuid(),
        tenantContext.TenantId,
        budget.Id,
        line.LedgerAccountId,
        line.PeriodStartUtc,
        line.PeriodEndUtc,
        line.BudgetAmount,
        line.Notes);

    dbContext.BudgetLines.Add(budgetLine);
}

try
{
    await dbContext.SaveChangesAsync(cancellationToken);
}
catch (DbUpdateException ex)
{
    return Conflict(new
    {
        Message = "Budget could not be updated because of a database constraint or relationship issue.",
        Detail = ex.InnerException?.Message ?? ex.Message,
        BudgetId = budgetId
    });
}

        await auditTrailWriter.WriteAsync(
            "budget",
            "Budget",
            "Updated",
            budget.Id,
            budget.BudgetNumber,
            $"Budget '{budget.BudgetNumber}' updated.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                budget.BudgetNumber,
                budget.Name,
                budget.Type,
                budget.Status,
                budget.OverrunPolicy,
                LineCount = request.Lines.Count
            },
            cancellationToken);

        return Ok(new
        {
            Message = "Budget updated successfully.",
            Budget = ProjectBudgetSummary(budget)
        });
    }

    [HttpDelete("{budgetId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.BudgetManage)]
    public async Task<IActionResult> DeleteBudget(
        Guid budgetId,
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

        var budget = await dbContext.Budgets
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == budgetId, cancellationToken);

        if (budget is null)
        {
            return NotFound(new { Message = "Budget was not found.", BudgetId = budgetId });
        }

        if (budget.Status != BudgetStatus.Draft && budget.Status != BudgetStatus.Rejected)
        {
            return Conflict(new { Message = "Only draft or rejected budgets can be deleted.", budget.Status });
        }

        var transfers = await dbContext.BudgetTransfers
            .Where(x => x.BudgetId == budgetId)
            .ToListAsync(cancellationToken);

        if (transfers.Count > 0)
        {
            dbContext.BudgetTransfers.RemoveRange(transfers);
        }

        var budgetReference = budget.BudgetNumber;
        var budgetName = budget.Name;
        var lineCount = budget.Lines.Count;

        dbContext.BudgetLines.RemoveRange(budget.Lines);
        dbContext.Budgets.Remove(budget);

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "budget",
            "Budget",
            "Deleted",
            budgetId,
            budgetReference,
            $"Budget '{budgetReference}' deleted.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                BudgetId = budgetId,
                BudgetNumber = budgetReference,
                BudgetName = budgetName,
                LineCount = lineCount
            },
            cancellationToken);

        return Ok(new { Message = "Budget deleted successfully.", BudgetId = budgetId });
    }

    [HttpPost("{budgetId:guid}/submit")]
    [Authorize(Policy = AuthorizationPolicies.BudgetSubmit)]
    public async Task<IActionResult> SubmitBudget(
        Guid budgetId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var budget = await dbContext.Budgets
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == budgetId, cancellationToken);

        if (budget is null) return NotFound(new { Message = "Budget was not found.", BudgetId = budgetId });

        try
        {
            budget.SubmitForApproval(currentUserService.UserId ?? "system");
            await dbContext.SaveChangesAsync(cancellationToken);

            await auditTrailWriter.WriteAsync(
                "budget",
                "Budget",
                "Submitted",
                budget.Id,
                budget.BudgetNumber,
                $"Budget '{budget.BudgetNumber}' submitted for approval.",
                User.Identity?.Name,
                budget.TenantId,
                new { budget.BudgetNumber, budget.Status },
                cancellationToken);

            return Ok(new { Message = "Budget submitted for approval successfully.", BudgetId = budget.Id, budget.Status });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { Message = ex.Message, BudgetId = budgetId, budget.Status });
        }
    }

    [HttpPost("{budgetId:guid}/approve")]
    [Authorize(Policy = AuthorizationPolicies.BudgetApprove)]
    public async Task<IActionResult> ApproveBudget(
        Guid budgetId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var budget = await dbContext.Budgets.FirstOrDefaultAsync(x => x.Id == budgetId, cancellationToken);
        if (budget is null) return NotFound(new { Message = "Budget was not found.", BudgetId = budgetId });

        try
        {
            budget.Approve(currentUserService.UserId ?? "system");
            await dbContext.SaveChangesAsync(cancellationToken);

            await auditTrailWriter.WriteAsync(
                "budget",
                "Budget",
                "Approved",
                budget.Id,
                budget.BudgetNumber,
                $"Budget '{budget.BudgetNumber}' approved.",
                User.Identity?.Name,
                budget.TenantId,
                new { budget.BudgetNumber, budget.Status },
                cancellationToken);

            return Ok(new { Message = "Budget approved successfully.", BudgetId = budget.Id, budget.Status });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { Message = ex.Message, BudgetId = budgetId, budget.Status });
        }
    }

    [HttpPost("{budgetId:guid}/reject")]
    [Authorize(Policy = AuthorizationPolicies.BudgetReject)]
    public async Task<IActionResult> RejectBudget(
        Guid budgetId,
        [FromBody] RejectBudgetRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var budget = await dbContext.Budgets.FirstOrDefaultAsync(x => x.Id == budgetId, cancellationToken);
        if (budget is null) return NotFound(new { Message = "Budget was not found.", BudgetId = budgetId });

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { Message = "Rejection reason is required." });
        }

        try
        {
            budget.Reject(currentUserService.UserId ?? "system", request.Reason);
            await dbContext.SaveChangesAsync(cancellationToken);

            await auditTrailWriter.WriteAsync(
                "budget",
                "Budget",
                "Rejected",
                budget.Id,
                budget.BudgetNumber,
                $"Budget '{budget.BudgetNumber}' rejected.",
                User.Identity?.Name,
                budget.TenantId,
                new { budget.BudgetNumber, budget.Status, request.Reason },
                cancellationToken);

            return Ok(new { Message = "Budget rejected successfully.", BudgetId = budget.Id, budget.Status });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { Message = ex.Message, BudgetId = budgetId, budget.Status });
        }
    }

    [HttpPost("{budgetId:guid}/lock")]
    [Authorize(Policy = AuthorizationPolicies.BudgetLock)]
    public async Task<IActionResult> LockBudget(
        Guid budgetId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var budget = await dbContext.Budgets.FirstOrDefaultAsync(x => x.Id == budgetId, cancellationToken);
        if (budget is null) return NotFound(new { Message = "Budget was not found.", BudgetId = budgetId });

        try
        {
            budget.Lock(currentUserService.UserId ?? "system");
            await dbContext.SaveChangesAsync(cancellationToken);

            await auditTrailWriter.WriteAsync(
                "budget",
                "Budget",
                "Locked",
                budget.Id,
                budget.BudgetNumber,
                $"Budget '{budget.BudgetNumber}' locked.",
                User.Identity?.Name,
                budget.TenantId,
                new { budget.BudgetNumber, budget.Status },
                cancellationToken);

            return Ok(new { Message = "Budget locked successfully.", BudgetId = budget.Id, budget.Status });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { Message = ex.Message, BudgetId = budgetId, budget.Status });
        }
    }

    [HttpPost("{budgetId:guid}/close")]
    [Authorize(Policy = AuthorizationPolicies.BudgetClose)]
    public async Task<IActionResult> CloseBudget(
        Guid budgetId,
        [FromBody] CloseBudgetRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var budget = await dbContext.Budgets.FirstOrDefaultAsync(x => x.Id == budgetId, cancellationToken);
        if (budget is null) return NotFound(new { Message = "Budget was not found.", BudgetId = budgetId });

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { Message = "Closure reason is required." });
        }

        try
        {
            budget.Close(currentUserService.UserId ?? "system", request.Reason);
            await dbContext.SaveChangesAsync(cancellationToken);

            await auditTrailWriter.WriteAsync(
                "budget",
                "Budget",
                "Closed",
                budget.Id,
                budget.BudgetNumber,
                $"Budget '{budget.BudgetNumber}' closed.",
                User.Identity?.Name,
                budget.TenantId,
                new { budget.BudgetNumber, budget.Status, request.Reason },
                cancellationToken);

            return Ok(new { Message = "Budget closed successfully.", BudgetId = budget.Id, budget.Status });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { Message = ex.Message, BudgetId = budgetId, budget.Status });
        }
    }

    [HttpPost("{budgetId:guid}/overrun-policy")]
    [Authorize(Policy = AuthorizationPolicies.BudgetManage)]
    public async Task<IActionResult> SetOverrunPolicy(
        Guid budgetId,
        [FromBody] SetBudgetOverrunPolicyRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var budget = await dbContext.Budgets.FirstOrDefaultAsync(x => x.Id == budgetId, cancellationToken);
        if (budget is null) return NotFound(new { Message = "Budget was not found.", BudgetId = budgetId });

        try
        {
            budget.SetOverrunPolicy(request.OverrunPolicy);
            await dbContext.SaveChangesAsync(cancellationToken);

            await auditTrailWriter.WriteAsync(
                "budget",
                "Budget",
                "OverrunPolicyUpdated",
                budget.Id,
                budget.BudgetNumber,
                $"Budget '{budget.BudgetNumber}' overrun policy updated.",
                User.Identity?.Name,
                budget.TenantId,
                new
                {
                    budget.BudgetNumber,
                    budget.OverrunPolicy,
                    budget.AllowOverrun
                },
                cancellationToken);

            return Ok(new
            {
                Message = "Budget overrun policy updated successfully.",
                BudgetId = budget.Id,
                budget.OverrunPolicy,
                budget.AllowOverrun
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { Message = ex.Message, BudgetId = budgetId, budget.Status });
        }
    }

    [HttpPost("{budgetId:guid}/transfers")]
    [Authorize(Policy = AuthorizationPolicies.BudgetTransfer)]
    public async Task<IActionResult> TransferBudgetAmount(
        Guid budgetId,
        [FromBody] TransferBudgetRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var budget = await dbContext.Budgets
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == budgetId, cancellationToken);

        if (budget is null)
        {
            return NotFound(new { Message = "Budget was not found.", BudgetId = budgetId });
        }

        if (budget.Status != BudgetStatus.Approved && budget.Status != BudgetStatus.Locked)
        {
            return Conflict(new { Message = "Budget transfers are allowed only on approved or locked budgets.", budget.Status });
        }

        if (budget.Status == BudgetStatus.Closed || budget.Status == BudgetStatus.Cancelled)
        {
            return Conflict(new { Message = "Closed or cancelled budgets cannot receive transfers.", budget.Status });
        }

        if (request.Amount <= 0m)
        {
            return BadRequest(new { Message = "Transfer amount must be greater than zero." });
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { Message = "Transfer reason is required." });
        }

        var fromLine = budget.Lines.FirstOrDefault(x => x.Id == request.FromBudgetLineId);
        var toLine = budget.Lines.FirstOrDefault(x => x.Id == request.ToBudgetLineId);

        if (fromLine is null || toLine is null)
        {
            return BadRequest(new { Message = "Both source and destination budget lines must belong to the selected budget." });
        }

        if (fromLine.Id == toLine.Id)
        {
            return BadRequest(new { Message = "Source and destination budget lines cannot be the same." });
        }

        if (request.Amount > fromLine.BudgetAmount)
        {
            return BadRequest(new
            {
                Message = "Transfer amount cannot exceed the source budget line amount.",
                SourceBudgetLineAmount = fromLine.BudgetAmount,
                RequestedTransferAmount = request.Amount
            });
        }

        fromLine.Update(
            fromLine.LedgerAccountId,
            fromLine.PeriodStartUtc,
            fromLine.PeriodEndUtc,
            fromLine.BudgetAmount - request.Amount,
            fromLine.Notes);

        toLine.Update(
            toLine.LedgerAccountId,
            toLine.PeriodStartUtc,
            toLine.PeriodEndUtc,
            toLine.BudgetAmount + request.Amount,
            toLine.Notes);

        var transfer = new BudgetTransfer(
            Guid.NewGuid(),
            tenantContext.TenantId,
            budget.Id,
            fromLine.Id,
            toLine.Id,
            request.Amount,
            request.Reason,
            currentUserService.UserId);

        dbContext.BudgetTransfers.Add(transfer);

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "budget",
            "BudgetTransfer",
            "Transferred",
            transfer.Id,
            budget.BudgetNumber,
            $"Budget transfer completed for budget '{budget.BudgetNumber}'.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                budget.BudgetNumber,
                transfer.FromBudgetLineId,
                transfer.ToBudgetLineId,
                transfer.Amount,
                transfer.Reason
            },
            cancellationToken);

       var transferUserNames = await GetUserDisplayNamesAsync(
    dbContext,
    new[] { transfer.TransferredBy },
    cancellationToken);

return Ok(new
{
    Message = "Budget transfer completed successfully.",
    Transfer = new
    {
        transfer.Id,
        transfer.BudgetId,
        transfer.FromBudgetLineId,
        transfer.ToBudgetLineId,
        transfer.Amount,
        transfer.Reason,
        transfer.TransferredBy,
        TransferredByDisplayName = ResolveUserDisplayName(transfer.TransferredBy, transferUserNames),
        transfer.TransferredOnUtc
    }
});

    }

    [Authorize(Policy = AuthorizationPolicies.BudgetView)]
    [HttpGet("upload-template")]
    public IActionResult DownloadBudgetUploadTemplate()
    {
        const string csv =
            "BudgetNumber,BudgetName,Description,BudgetType,PeriodStart,PeriodEnd,OverrunPolicy,LedgerAccountCode,LinePeriodStart,LinePeriodEnd,BudgetAmount,Notes\n" +
            "BUD-2026-001,2026 Operating Budget,Annual operating budget,Operating,2026-01-01,2026-12-31,WarnOnly,5000,2026-01-01,2026-01-31,250000,January budget\n" +
            "BUD-2026-001,2026 Operating Budget,Annual operating budget,Operating,2026-01-01,2026-12-31,WarnOnly,5000,2026-02-01,2026-02-28,260000,February budget\n";

        return File(Encoding.UTF8.GetBytes(csv), "text/csv", "ibalance-budget-upload-template.csv");
    }

    [HttpPost("upload")]
    [Authorize(Policy = AuthorizationPolicies.BudgetCreate)]
    public async Task<IActionResult> UploadBudget(
        [FromBody] UploadBudgetRequest request,
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

        if (request.Rows is null || request.Rows.Count == 0)
        {
            return BadRequest(new { Message = "At least one budget upload row is required." });
        }

        var first = request.Rows[0];

        if (request.Rows.Any(x => !string.Equals(x.BudgetNumber, first.BudgetNumber, StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest(new { Message = "One upload file can create only one budget number at a time." });
        }

        if (!TryParseBudgetType(first.BudgetType, out var budgetType))
        {
            return BadRequest(new { Message = "Invalid budget type.", first.BudgetType });
        }

        if (!TryParseOverrunPolicy(first.OverrunPolicy, out var overrunPolicy))
        {
            return BadRequest(new { Message = "Invalid overrun policy.", first.OverrunPolicy });
        }

        var ledgerCodes = request.Rows
            .Select(x => x.LedgerAccountCode.Trim().ToUpperInvariant())
            .Distinct()
            .ToList();

        var ledgerAccounts = await dbContext.LedgerAccounts
            .Where(x => ledgerCodes.Contains(x.Code))
            .ToListAsync(cancellationToken);

        var errors = new List<object>();

        foreach (var row in request.Rows.Select((value, index) => new { value, index }))
        {
            var account = ledgerAccounts.FirstOrDefault(x =>
                x.Code == row.value.LedgerAccountCode.Trim().ToUpperInvariant());

            if (account is null)
            {
                errors.Add(new { Row = row.index + 1, Message = "Ledger account code was not found.", row.value.LedgerAccountCode });
                continue;
            }

            if (!account.IsActive || account.IsHeader || !account.IsPostingAllowed)
            {
                errors.Add(new { Row = row.index + 1, Message = "Ledger account must be active and posting allowed.", account.Code, account.Name });
            }

            if (row.value.BudgetAmount < 0m)
            {
                errors.Add(new { Row = row.index + 1, Message = "Budget amount cannot be negative." });
            }

            if (row.value.LinePeriodEnd < row.value.LinePeriodStart)
            {
                errors.Add(new { Row = row.index + 1, Message = "Line period end date cannot be earlier than start date." });
            }
        }

        if (errors.Count > 0)
        {
            return BadRequest(new { Message = "Budget upload validation failed.", Errors = errors });
        }

        var duplicateExists = await dbContext.Budgets
            .AnyAsync(x => x.BudgetNumber == first.BudgetNumber.Trim().ToUpperInvariant(), cancellationToken);

        if (duplicateExists)
        {
            return Conflict(new { Message = "A budget with the same budget number already exists.", first.BudgetNumber });
        }

        var budget = new Budget(
            Guid.NewGuid(),
            tenantContext.TenantId,
            first.BudgetNumber,
            first.BudgetName,
            first.Description,
            budgetType,
            first.PeriodStart,
            first.PeriodEnd,
            request.Notes);

        budget.SetOverrunPolicy(overrunPolicy);

        foreach (var row in request.Rows)
        {
            var account = ledgerAccounts.First(x => x.Code == row.LedgerAccountCode.Trim().ToUpperInvariant());

            budget.AddLine(new BudgetLine(
                Guid.NewGuid(),
                tenantContext.TenantId,
                budget.Id,
                account.Id,
                row.LinePeriodStart,
                row.LinePeriodEnd,
                row.BudgetAmount,
                row.Notes));
        }

        dbContext.Budgets.Add(budget);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "budget",
            "Budget",
            "Created",
            budget.Id,
            budget.BudgetNumber,
            $"Budget '{budget.BudgetNumber}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                budget.BudgetNumber,
                budget.Name,
                budget.Type,
                budget.PeriodStartUtc,
                budget.PeriodEndUtc,
                budget.OverrunPolicy,
                LineCount = budget.Lines.Count
            },
            cancellationToken);

        return Ok(new
        {
            Message = "Budget uploaded successfully as draft.",
            Budget = ProjectBudgetSummary(budget)
        });
    }


[Authorize(Policy = AuthorizationPolicies.BudgetReportsView)]
[HttpGet("reports/budget-vs-actual-consolidated")]
public async Task<IActionResult> GetConsolidatedBudgetVsActual(
    [FromQuery] DateTime periodStartUtc,
    [FromQuery] DateTime periodEndUtc,
    [FromQuery] BudgetType? budgetType,
    [FromServices] ApplicationDbContext dbContext,
    [FromServices] ITenantContextAccessor tenantContextAccessor,
    CancellationToken cancellationToken)
{
    var tenantContext = tenantContextAccessor.Current;

    if (!tenantContext.IsAvailable)
    {
        return BadRequest(new
        {
            Message = "Tenant context is required.",
            RequiredHeader = "X-Tenant-Key"
        });
    }

    if (periodStartUtc == default || periodEndUtc == default)
    {
        return BadRequest(new
        {
            Message = "Report period start and end dates are required."
        });
    }

    if (periodEndUtc.Date < periodStartUtc.Date)
    {
        return BadRequest(new
        {
            Message = "Report period end date cannot be earlier than report period start date."
        });
    }

    var reportStartUtc = periodStartUtc.Date;
    var reportEndUtc = periodEndUtc.Date.AddDays(1).AddTicks(-1);

    var reportableStatuses = new[]
    {
        BudgetStatus.Approved,
        BudgetStatus.Locked,
        BudgetStatus.Closed
    };

    var budgetsQuery = dbContext.Budgets
    .AsNoTracking()
    .Include(x => x.Lines)
        .ThenInclude(x => x.LedgerAccount)
    .Where(x =>
        reportableStatuses.Contains(x.Status) &&
        x.PeriodStartUtc.Date <= reportEndUtc.Date &&
        x.PeriodEndUtc.Date >= reportStartUtc.Date);

if (budgetType.HasValue)
{
    budgetsQuery = budgetsQuery.Where(x => x.Type == budgetType.Value);
}

var budgets = await budgetsQuery
    .OrderBy(x => x.Type)
    .ThenBy(x => x.BudgetNumber)
    .ToListAsync(cancellationToken);

    var lineAccountIds = budgets
        .SelectMany(x => x.Lines)
        .Select(x => x.LedgerAccountId)
        .Distinct()
        .ToList();

    var actualLines = lineAccountIds.Count == 0
        ? new List<JournalEntryLine>()
        : await dbContext.JournalEntryLines
            .AsNoTracking()
            .Include(x => x.JournalEntry)
            .Include(x => x.LedgerAccount)
            .Where(x =>
                lineAccountIds.Contains(x.LedgerAccountId) &&
                x.JournalEntry.Status == JournalEntryStatus.Posted &&
                x.JournalEntry.EntryDateUtc >= reportStartUtc &&
                x.JournalEntry.EntryDateUtc <= reportEndUtc)
            .ToListAsync(cancellationToken);

    var sections = budgets
        .GroupBy(x => x.Type)
        .OrderBy(x => x.Key)
        .Select(section =>
        {
            var sectionBudgets = section
                .OrderBy(x => x.BudgetNumber)
                .Select(budget =>
                {
                    var budgetItems = budget.Lines
                        .OrderBy(x => x.LedgerAccount.Code)
                        .ThenBy(x => x.PeriodStartUtc)
                        .Select(line =>
                        {
                            var actualForLine = actualLines
                                .Where(x =>
                                    x.LedgerAccountId == line.LedgerAccountId &&
                                    x.JournalEntry.EntryDateUtc >= line.PeriodStartUtc &&
                                    x.JournalEntry.EntryDateUtc <= line.PeriodEndUtc)
                                .ToList();

                            var actualAmount = actualForLine.Sum(x =>
                                x.LedgerAccount.NormalBalance == AccountNature.Debit
                                    ? x.DebitAmount - x.CreditAmount
                                    : x.CreditAmount - x.DebitAmount);

                            var varianceAmount = line.BudgetAmount - actualAmount;

                            var utilizationPercent = line.BudgetAmount == 0m
                                ? 0m
                                : Math.Round((actualAmount / line.BudgetAmount) * 100m, 2);

                            var isOverBudget = actualAmount > line.BudgetAmount;

                            return new
                            {
                                BudgetLineId = line.Id,
                                line.LedgerAccountId,
                                LedgerAccountCode = line.LedgerAccount.Code,
                                LedgerAccountName = line.LedgerAccount.Name,
                                line.LedgerAccount.Category,
                                line.LedgerAccount.NormalBalance,
                                line.PeriodStartUtc,
                                line.PeriodEndUtc,
                                line.BudgetAmount,
                                ActualAmount = actualAmount,
                                VarianceAmount = varianceAmount,
                                UtilizationPercent = utilizationPercent,
                                IsOverBudget = isOverBudget,
                                BudgetOverrunPolicy = budget.OverrunPolicy,
                                OverrunStatus = ResolveOverrunStatus(isOverBudget, budget.OverrunPolicy),
                                line.Notes
                            };
                        })
                        .ToList();

                    return new
                    {
                        budget.Id,
                        budget.BudgetNumber,
                        budget.Name,
                        budget.Description,
                        budget.Type,
                        BudgetTypeName = budget.Type.ToString(),
                        budget.PeriodStartUtc,
                        budget.PeriodEndUtc,
                        budget.Status,
                        budget.OverrunPolicy,
                        budget.AllowOverrun,
                        budget.Notes,
                        LineCount = budgetItems.Count,
                        TotalBudgetAmount = budgetItems.Sum(x => x.BudgetAmount),
                        TotalActualAmount = budgetItems.Sum(x => x.ActualAmount),
                        TotalVarianceAmount = budgetItems.Sum(x => x.VarianceAmount),
                        OverBudgetLineCount = budgetItems.Count(x => x.IsOverBudget),
                        Items = budgetItems
                    };
                })
                .ToList();

            return new
            {
                BudgetType = section.Key,
                BudgetTypeName = section.Key.ToString(),
                BudgetCount = sectionBudgets.Count,
                TotalBudgetAmount = sectionBudgets.Sum(x => x.TotalBudgetAmount),
                TotalActualAmount = sectionBudgets.Sum(x => x.TotalActualAmount),
                TotalVarianceAmount = sectionBudgets.Sum(x => x.TotalVarianceAmount),
                OverBudgetLineCount = sectionBudgets.Sum(x => x.OverBudgetLineCount),
                Budgets = sectionBudgets
            };
        })
        .ToList();

    return Ok(new
    {
        TenantContextAvailable = true,
        TenantId = tenantContext.TenantId,
        TenantKey = tenantContext.TenantKey,
        ReportMode = budgetType.HasValue ? "BudgetType" : "Consolidated",
        BudgetType = budgetType,
        BudgetTypeName = budgetType.HasValue ? budgetType.Value.ToString() : null,
        PeriodStartUtc = reportStartUtc,
        PeriodEndUtc = reportEndUtc,
        SectionCount = sections.Count,
        BudgetCount = budgets.Count,
        TotalBudgetAmount = sections.Sum(x => x.TotalBudgetAmount),
        TotalActualAmount = sections.Sum(x => x.TotalActualAmount),
        TotalVarianceAmount = sections.Sum(x => x.TotalVarianceAmount),
        OverBudgetLineCount = sections.Sum(x => x.OverBudgetLineCount),
        Sections = sections
    });
}

    [Authorize(Policy = AuthorizationPolicies.BudgetReportsView)]
    [HttpGet("reports/budget-vs-actual")]
    public async Task<IActionResult> GetBudgetVsActual(
        [FromQuery] Guid budgetId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var budget = await dbContext.Budgets
            .AsNoTracking()
            .Include(x => x.Lines)
                .ThenInclude(x => x.LedgerAccount)
            .FirstOrDefaultAsync(x => x.Id == budgetId, cancellationToken);

        if (budget is null)
        {
            return NotFound(new { Message = "Budget was not found.", BudgetId = budgetId });
        }

        var lineAccountIds = budget.Lines.Select(x => x.LedgerAccountId).Distinct().ToList();

        var actualLines = await dbContext.JournalEntryLines
            .AsNoTracking()
            .Include(x => x.JournalEntry)
            .Include(x => x.LedgerAccount)
            .Where(x =>
                lineAccountIds.Contains(x.LedgerAccountId) &&
                x.JournalEntry.Status == JournalEntryStatus.Posted &&
                x.JournalEntry.EntryDateUtc >= budget.PeriodStartUtc &&
                x.JournalEntry.EntryDateUtc <= budget.PeriodEndUtc)
            .ToListAsync(cancellationToken);

        var items = budget.Lines
            .OrderBy(x => x.LedgerAccount.Code)
            .ThenBy(x => x.PeriodStartUtc)
            .Select(line =>
            {
                var actualForLine = actualLines
                    .Where(x =>
                        x.LedgerAccountId == line.LedgerAccountId &&
                        x.JournalEntry.EntryDateUtc >= line.PeriodStartUtc &&
                        x.JournalEntry.EntryDateUtc <= line.PeriodEndUtc)
                    .ToList();

                var actualAmount = actualForLine.Sum(x =>
                    x.LedgerAccount.NormalBalance == AccountNature.Debit
                        ? x.DebitAmount - x.CreditAmount
                        : x.CreditAmount - x.DebitAmount);

                var varianceAmount = line.BudgetAmount - actualAmount;
                var utilizationPercent = line.BudgetAmount == 0m
                    ? 0m
                    : Math.Round((actualAmount / line.BudgetAmount) * 100m, 2);

                var isOverBudget = actualAmount > line.BudgetAmount;

                return new
                {
                    BudgetLineId = line.Id,
                    line.LedgerAccountId,
                    LedgerAccountCode = line.LedgerAccount.Code,
                    LedgerAccountName = line.LedgerAccount.Name,
                    line.LedgerAccount.Category,
                    line.LedgerAccount.NormalBalance,
                    line.PeriodStartUtc,
                    line.PeriodEndUtc,
                    line.BudgetAmount,
                    ActualAmount = actualAmount,
                    VarianceAmount = varianceAmount,
                    UtilizationPercent = utilizationPercent,
                    IsOverBudget = isOverBudget,
                    BudgetOverrunPolicy = budget.OverrunPolicy,
                    OverrunStatus = ResolveOverrunStatus(isOverBudget, budget.OverrunPolicy),
                    line.Notes
                };
            })
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Budget = ProjectBudgetSummary(budget),
            TotalBudgetAmount = items.Sum(x => x.BudgetAmount),
            TotalActualAmount = items.Sum(x => x.ActualAmount),
            TotalVarianceAmount = items.Sum(x => x.VarianceAmount),
            OverBudgetLineCount = items.Count(x => x.IsOverBudget),
            Count = items.Count,
            Items = items
        });
    }

    private static async Task<Dictionary<string, string>> GetUserDisplayNamesAsync(
    ApplicationDbContext dbContext,
    IEnumerable<string?> userIds,
    CancellationToken cancellationToken)
{
    var parsedUserIds = userIds
        .Where(x => !string.IsNullOrWhiteSpace(x))
        .Select(x => x!.Trim())
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .Select(x => Guid.TryParse(x, out var parsed) ? parsed : Guid.Empty)
        .Where(x => x != Guid.Empty)
        .Distinct()
        .ToList();

    if (parsedUserIds.Count == 0)
    {
        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    }

    var users = await dbContext.UserAccounts
        .AsNoTracking()
        .Where(x => parsedUserIds.Contains(x.Id))
        .Select(x => new
        {
            x.Id,
            x.FirstName,
            x.LastName,
            x.Email
        })
        .ToListAsync(cancellationToken);

    return users.ToDictionary(
        x => x.Id.ToString(),
        x =>
        {
            var fullName = $"{x.FirstName} {x.LastName}".Trim();
            return string.IsNullOrWhiteSpace(fullName) ? x.Email : fullName;
        },
        StringComparer.OrdinalIgnoreCase);
}

private static string ResolveUserDisplayName(
    string? userId,
    IReadOnlyDictionary<string, string> userNames)
{
    if (string.IsNullOrWhiteSpace(userId))
    {
        return string.Empty;
    }

    return userNames.TryGetValue(userId.Trim(), out var displayName)
        ? displayName
        : userId.Trim();
}

  private static object ProjectBudgetSummary(
    Budget budget,
    IReadOnlyDictionary<string, string>? userNames = null)
{
    userNames ??= new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

    return new
    {
        budget.Id,
        budget.BudgetNumber,
        budget.Name,
        budget.Description,
        budget.Type,
        budget.PeriodStartUtc,
        budget.PeriodEndUtc,
        budget.Status,
        budget.OverrunPolicy,
        budget.AllowOverrun,
        budget.Notes,

        budget.SubmittedBy,
        SubmittedByDisplayName = ResolveUserDisplayName(budget.SubmittedBy, userNames),
        budget.SubmittedOnUtc,

        budget.ApprovedBy,
        ApprovedByDisplayName = ResolveUserDisplayName(budget.ApprovedBy, userNames),
        budget.ApprovedOnUtc,

        budget.RejectedBy,
        RejectedByDisplayName = ResolveUserDisplayName(budget.RejectedBy, userNames),
        budget.RejectedOnUtc,
        budget.RejectionReason,

        budget.LockedBy,
        LockedByDisplayName = ResolveUserDisplayName(budget.LockedBy, userNames),
        budget.LockedOnUtc,

        budget.ClosedBy,
        ClosedByDisplayName = ResolveUserDisplayName(budget.ClosedBy, userNames),
        budget.ClosedOnUtc,
        budget.ClosureReason,

        budget.CancelledOnUtc,

        LineCount = budget.Lines.Count,
        TotalAmount = budget.Lines.Sum(x => x.BudgetAmount)
    };
}

   private static object ProjectBudgetDetail(
    Budget budget,
    IReadOnlyDictionary<string, string>? userNames = null)
{
    userNames ??= new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

    return new
    {
        budget.Id,
        budget.BudgetNumber,
        budget.Name,
        budget.Description,
        budget.Type,
        budget.PeriodStartUtc,
        budget.PeriodEndUtc,
        budget.Status,
        budget.OverrunPolicy,
        budget.AllowOverrun,
        budget.Notes,

        budget.SubmittedBy,
        SubmittedByDisplayName = ResolveUserDisplayName(budget.SubmittedBy, userNames),
        budget.SubmittedOnUtc,

        budget.ApprovedBy,
        ApprovedByDisplayName = ResolveUserDisplayName(budget.ApprovedBy, userNames),
        budget.ApprovedOnUtc,

        budget.RejectedBy,
        RejectedByDisplayName = ResolveUserDisplayName(budget.RejectedBy, userNames),
        budget.RejectedOnUtc,
        budget.RejectionReason,

        budget.LockedBy,
        LockedByDisplayName = ResolveUserDisplayName(budget.LockedBy, userNames),
        budget.LockedOnUtc,

        budget.ClosedBy,
        ClosedByDisplayName = ResolveUserDisplayName(budget.ClosedBy, userNames),
        budget.ClosedOnUtc,
        budget.ClosureReason,

        budget.CancelledOnUtc,

        LineCount = budget.Lines.Count,
        TotalAmount = budget.Lines.Sum(x => x.BudgetAmount),

        Lines = budget.Lines
            .OrderBy(x => x.LedgerAccount.Code)
            .ThenBy(x => x.PeriodStartUtc)
            .Select(x => new
            {
                x.Id,
                x.LedgerAccountId,
                LedgerAccountCode = x.LedgerAccount.Code,
                LedgerAccountName = x.LedgerAccount.Name,
                x.LedgerAccount.Category,
                x.LedgerAccount.NormalBalance,
                x.PeriodStartUtc,
                x.PeriodEndUtc,
                x.BudgetAmount,
                x.Notes
            })
            .ToList()
    };
}

    private static async Task<IActionResult?> ValidateBudgetRequestAsync(
        ApplicationDbContext dbContext,
        Guid tenantId,
        Guid? existingBudgetId,
        CreateBudgetRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.BudgetNumber)) return new BadRequestObjectResult(new { Message = "Budget number is required." });
        if (string.IsNullOrWhiteSpace(request.Name)) return new BadRequestObjectResult(new { Message = "Budget name is required." });
        if (string.IsNullOrWhiteSpace(request.Description)) return new BadRequestObjectResult(new { Message = "Budget description is required." });
        if (request.PeriodEndUtc < request.PeriodStartUtc) return new BadRequestObjectResult(new { Message = "Budget period end date cannot be earlier than start date." });
        var budgetPeriodStartDate = DateOnly.FromDateTime(request.PeriodStartUtc.Date);
        var budgetPeriodEndDate = DateOnly.FromDateTime(request.PeriodEndUtc.Date);

        var matchingOpenFiscalPeriod = await dbContext.FiscalPeriods
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.Status == FiscalPeriodStatus.Open &&
                budgetPeriodStartDate >= x.StartDate &&
                budgetPeriodEndDate <= x.EndDate,
                cancellationToken);

        if (matchingOpenFiscalPeriod is null)
        {
            return new BadRequestObjectResult(new
            {
                Message = "Budget can only be created or updated within an open fiscal period.",
                PeriodStartUtc = request.PeriodStartUtc,
                PeriodEndUtc = request.PeriodEndUtc
            });
        }
        if (request.Lines is null || request.Lines.Count == 0) return new BadRequestObjectResult(new { Message = "At least one budget line is required." });

        var normalizedBudgetNumber = request.BudgetNumber.Trim().ToUpperInvariant();

        var duplicateExists = await dbContext.Budgets
            .AnyAsync(x =>
                x.BudgetNumber == normalizedBudgetNumber &&
                (!existingBudgetId.HasValue || x.Id != existingBudgetId.Value),
                cancellationToken);

        if (duplicateExists)
        {
            return new ConflictObjectResult(new { Message = "A budget with the same number already exists.", request.BudgetNumber });
        }

        var accountIds = request.Lines.Select(x => x.LedgerAccountId).Distinct().ToList();

        var accounts = await dbContext.LedgerAccounts
            .Where(x => accountIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        if (accounts.Count != accountIds.Count)
        {
            return new BadRequestObjectResult(new { Message = "One or more selected ledger accounts were not found." });
        }

        foreach (var line in request.Lines)
        {
            var account = accounts.First(x => x.Id == line.LedgerAccountId);

            if (!account.IsActive || account.IsHeader || !account.IsPostingAllowed)
            {
                return new BadRequestObjectResult(new
                {
                    Message = "Budget lines can only be assigned to active posting ledger accounts.",
                    account.Id,
                    account.Code,
                    account.Name
                });
            }

            if (line.PeriodEndUtc < line.PeriodStartUtc)
            {
                return new BadRequestObjectResult(new { Message = "Budget line period end date cannot be earlier than start date." });
            }

            if (line.PeriodStartUtc < request.PeriodStartUtc || line.PeriodEndUtc > request.PeriodEndUtc)
            {
                return new BadRequestObjectResult(new { Message = "Budget line period must fall within the budget period." });
            }

            if (line.BudgetAmount < 0m)
            {
                return new BadRequestObjectResult(new { Message = "Budget amount cannot be negative." });
            }
        }

        return null;
    }

    private static bool TryParseBudgetType(string value, out BudgetType budgetType)
    {
        if (Enum.TryParse(value, true, out budgetType)) return true;
        if (int.TryParse(value, out var number) && Enum.IsDefined(typeof(BudgetType), number))
        {
            budgetType = (BudgetType)number;
            return true;
        }

        return false;
    }


    private static async Task<bool> BudgetLineHasPostedActualMovementAsync(
    ApplicationDbContext dbContext,
    BudgetLine line,
    CancellationToken cancellationToken)
{
    if (line.BudgetAmount <= 0m)
    {
        return false;
    }

    return await dbContext.JournalEntryLines
        .AsNoTracking()
        .Include(x => x.JournalEntry)
        .AnyAsync(
            x => x.LedgerAccountId == line.LedgerAccountId &&
                 x.JournalEntry.Status == JournalEntryStatus.Posted &&
                 x.JournalEntry.EntryDateUtc >= line.PeriodStartUtc &&
                 x.JournalEntry.EntryDateUtc <= line.PeriodEndUtc,
            cancellationToken);
}

    private static bool TryParseOverrunPolicy(string value, out BudgetOverrunPolicy policy)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            policy = BudgetOverrunPolicy.WarnOnly;
            return true;
        }

        if (Enum.TryParse(value, true, out policy)) return true;
        if (int.TryParse(value, out var number) && Enum.IsDefined(typeof(BudgetOverrunPolicy), number))
        {
            policy = (BudgetOverrunPolicy)number;
            return true;
        }

        return false;
    }

    private static string ResolveOverrunStatus(bool isOverBudget, BudgetOverrunPolicy policy)
    {
        if (!isOverBudget) return "Within Budget";

        return policy switch
        {
            BudgetOverrunPolicy.Disallow => "Over Budget - Disallowed",
            BudgetOverrunPolicy.RequireApproval => "Over Budget - Approval Required",
            BudgetOverrunPolicy.WarnOnly => "Over Budget - Warning",
            BudgetOverrunPolicy.Allow => "Over Budget - Allowed",
            _ => "Over Budget"
        };
    }
}

public sealed record CreateBudgetRequest(
    string BudgetNumber,
    string Name,
    string Description,
    BudgetType Type,
    DateTime PeriodStartUtc,
    DateTime PeriodEndUtc,
    string? Notes,
    BudgetOverrunPolicy? OverrunPolicy,
    List<BudgetLineRequest> Lines);

public sealed record BudgetLineRequest(
    Guid? Id,
    Guid LedgerAccountId,
    DateTime PeriodStartUtc,
    DateTime PeriodEndUtc,
    decimal BudgetAmount,
    string? Notes);

public sealed record RejectBudgetRequest(string Reason);

public sealed record CloseBudgetRequest(string Reason);

public sealed record SetBudgetOverrunPolicyRequest(BudgetOverrunPolicy OverrunPolicy);

public sealed record TransferBudgetRequest(
    Guid FromBudgetLineId,
    Guid ToBudgetLineId,
    decimal Amount,
    string Reason);

public sealed record UploadBudgetRequest(
    string? Notes,
    List<UploadBudgetRowRequest> Rows);

public sealed record UploadBudgetRowRequest(
    string BudgetNumber,
    string BudgetName,
    string Description,
    string BudgetType,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    string OverrunPolicy,
    string LedgerAccountCode,
    DateTime LinePeriodStart,
    DateTime LinePeriodEnd,
    decimal BudgetAmount,
    string? Notes);