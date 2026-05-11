using iBalance.Api.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Finance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/finance/working-capital")]
public sealed class WorkingCapitalController : ControllerBase
{
    [Authorize(Policy = AuthorizationPolicies.ReportsView)]
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard(
        [FromQuery] DateTime? asOfUtc,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
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

        var effectiveAsOfUtc = asOfUtc ?? DateTime.UtcNow;
        var effectiveToUtc = toUtc ?? effectiveAsOfUtc;
        var effectiveFromUtc = fromUtc ?? effectiveToUtc.AddDays(-90);

        if (effectiveFromUtc > effectiveToUtc)
        {
            return BadRequest(new
            {
                Message = "From date cannot be later than To date.",
                FromUtc = effectiveFromUtc,
                ToUtc = effectiveToUtc
            });
        }

        var periodDays = Math.Max(1m, (decimal)(effectiveToUtc.Date - effectiveFromUtc.Date).TotalDays + 1m);

        var cashBalance = await dbContext.LedgerMovements
            .AsNoTracking()
            .Join(
                dbContext.LedgerAccounts.AsNoTracking(),
                movement => movement.LedgerAccountId,
                account => account.Id,
                (movement, account) => new
                {
                    account.IsCashOrBankAccount,
                    movement.MovementDateUtc,
                    movement.DebitAmount,
                    movement.CreditAmount
                })
            .Where(x => x.IsCashOrBankAccount && x.MovementDateUtc <= effectiveAsOfUtc)
            .SumAsync(x => x.DebitAmount - x.CreditAmount, cancellationToken);

        var receivables = await dbContext.SalesInvoices
            .AsNoTracking()
            .Where(x =>
                x.InvoiceDateUtc <= effectiveAsOfUtc &&
                x.Status != SalesInvoiceStatus.Rejected &&
                x.Status != SalesInvoiceStatus.Cancelled)
            .Select(x => new
            {
                x.Id,
                x.InvoiceDateUtc,
                x.InvoiceNumber,
                PartyCode = x.Customer != null ? x.Customer.CustomerCode : string.Empty,
                PartyName = x.Customer != null ? x.Customer.CustomerName : string.Empty,
                x.TotalAmount,
                x.NetReceivableAmount,
                x.AmountPaid,
                x.BalanceAmount,
                x.Status
            })
            .ToListAsync(cancellationToken);

        var payables = await dbContext.PurchaseInvoices
            .AsNoTracking()
            .Where(x =>
                x.InvoiceDateUtc <= effectiveAsOfUtc &&
                x.Status != PurchaseInvoiceStatus.Rejected &&
                x.Status != PurchaseInvoiceStatus.Cancelled)
            .Select(x => new
            {
                x.Id,
                x.InvoiceDateUtc,
                x.InvoiceNumber,
                PartyCode = x.Vendor != null ? x.Vendor.VendorCode : string.Empty,
                PartyName = x.Vendor != null ? x.Vendor.VendorName : string.Empty,
                x.TotalAmount,
                x.NetPayableAmount,
                x.AmountPaid,
                x.BalanceAmount,
                x.Status
            })
            .ToListAsync(cancellationToken);

        var stockEntries = await dbContext.StockLedgerEntries
            .AsNoTracking()
            .Where(x => x.MovementDateUtc <= effectiveAsOfUtc)
            .ToListAsync(cancellationToken);

        var inventoryValue = stockEntries.Sum(x => (x.QuantityIn * x.UnitCost) - (x.QuantityOut * x.UnitCost));

        var periodSalesAmount = receivables
            .Where(x => x.InvoiceDateUtc >= effectiveFromUtc && x.InvoiceDateUtc <= effectiveToUtc)
            .Sum(x => x.NetReceivableAmount > 0m ? x.NetReceivableAmount : x.TotalAmount);

        var periodPurchaseAmount = payables
            .Where(x => x.InvoiceDateUtc >= effectiveFromUtc && x.InvoiceDateUtc <= effectiveToUtc)
            .Sum(x => x.NetPayableAmount > 0m ? x.NetPayableAmount : x.TotalAmount);

        var periodInventoryOutValue = await dbContext.StockLedgerEntries
            .AsNoTracking()
            .Where(x => x.MovementDateUtc >= effectiveFromUtc && x.MovementDateUtc <= effectiveToUtc)
            .SumAsync(x => x.QuantityOut * x.UnitCost, cancellationToken);

        var accountsReceivableBalance = receivables.Sum(x => x.BalanceAmount);
        var accountsPayableBalance = payables.Sum(x => x.BalanceAmount);
        var operatingWorkingCapital = accountsReceivableBalance + inventoryValue - accountsPayableBalance;
        var netWorkingCapital = cashBalance + operatingWorkingCapital;

        var dso = periodSalesAmount > 0m
            ? accountsReceivableBalance / periodSalesAmount * periodDays
            : 0m;

        var dpo = periodPurchaseAmount > 0m
            ? accountsPayableBalance / periodPurchaseAmount * periodDays
            : 0m;

        var inventoryDays = periodInventoryOutValue > 0m
            ? inventoryValue / periodInventoryOutValue * periodDays
            : 0m;

        var cashConversionCycle = dso + inventoryDays - dpo;

        var overdueReceivables = receivables
            .Where(x => x.BalanceAmount > 0m && (effectiveAsOfUtc.Date - x.InvoiceDateUtc.Date).TotalDays > 30)
            .OrderByDescending(x => x.BalanceAmount)
            .Take(10)
            .Select(x => new
            {
                x.Id,
                Reference = x.InvoiceNumber,
                x.InvoiceDateUtc,
                PartyCode = x.PartyCode,
                PartyName = x.PartyName,
                OutstandingAmount = x.BalanceAmount,
                DaysOutstanding = Math.Max(0, (int)(effectiveAsOfUtc.Date - x.InvoiceDateUtc.Date).TotalDays)
            })
            .ToList();

        var duePayables = payables
            .Where(x => x.BalanceAmount > 0m)
            .OrderByDescending(x => x.BalanceAmount)
            .Take(10)
            .Select(x => new
            {
                x.Id,
                Reference = x.InvoiceNumber,
                x.InvoiceDateUtc,
                PartyCode = x.PartyCode,
                PartyName = x.PartyName,
                OutstandingAmount = x.BalanceAmount,
                DaysOutstanding = Math.Max(0, (int)(effectiveAsOfUtc.Date - x.InvoiceDateUtc.Date).TotalDays)
            })
            .ToList();

        var inventoryRows = stockEntries
            .GroupBy(x => x.InventoryItemId)
            .Select(x => new
            {
                InventoryItemId = x.Key,
                QuantityOnHand = x.Sum(y => y.QuantityIn - y.QuantityOut),
                InventoryValue = x.Sum(y => (y.QuantityIn * y.UnitCost) - (y.QuantityOut * y.UnitCost))
            })
            .Where(x => Math.Abs(x.InventoryValue) >= 0.01m || Math.Abs(x.QuantityOnHand) >= 0.0001m)
            .OrderByDescending(x => x.InventoryValue)
            .Take(10)
            .ToList();

        var inventoryItemIds = inventoryRows.Select(x => x.InventoryItemId).Distinct().ToList();
        var inventoryItems = await dbContext.InventoryItems
            .AsNoTracking()
            .Where(x => inventoryItemIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var topInventory = inventoryRows
            .Select(x =>
            {
                inventoryItems.TryGetValue(x.InventoryItemId, out var item);
                return new
                {
                    x.InventoryItemId,
                    ItemCode = item?.ItemCode ?? string.Empty,
                    ItemName = item?.ItemName ?? string.Empty,
                    x.QuantityOnHand,
                    x.InventoryValue
                };
            })
            .ToList();

        var riskLevel = ResolveRiskLevel(cashConversionCycle, accountsReceivableBalance, accountsPayableBalance, cashBalance);

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            AsOfUtc = effectiveAsOfUtc,
            FromUtc = effectiveFromUtc,
            ToUtc = effectiveToUtc,
            PeriodDays = periodDays,
            CashBalance = cashBalance,
            AccountsReceivableBalance = accountsReceivableBalance,
            AccountsPayableBalance = accountsPayableBalance,
            InventoryValue = inventoryValue,
            OperatingWorkingCapital = operatingWorkingCapital,
            NetWorkingCapital = netWorkingCapital,
            PeriodSalesAmount = periodSalesAmount,
            PeriodPurchaseAmount = periodPurchaseAmount,
            PeriodInventoryOutValue = periodInventoryOutValue,
            DsoDays = Math.Round(dso, 2),
            DpoDays = Math.Round(dpo, 2),
            InventoryDays = Math.Round(inventoryDays, 2),
            CashConversionCycleDays = Math.Round(cashConversionCycle, 2),
            RiskLevel = riskLevel,
            OverdueReceivables = overdueReceivables,
            DuePayables = duePayables,
            TopInventory = topInventory
        });
    }

    private static string ResolveRiskLevel(decimal cashConversionCycle, decimal receivables, decimal payables, decimal cash)
    {
        if (cash < 0m)
        {
            return "Critical";
        }

        if (cashConversionCycle > 120m || receivables > payables * 2m)
        {
            return "High";
        }

        if (cashConversionCycle > 60m)
        {
            return "Moderate";
        }

        return "Healthy";
    }

    [Authorize(Policy = AuthorizationPolicies.ReportsView)]
    [HttpGet("receivables-health")]
    public async Task<IActionResult> GetReceivablesHealth(
        [FromQuery] DateTime? asOfUtc,
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

        var effectiveAsOfUtc = asOfUtc ?? DateTime.UtcNow;

        var rows = await dbContext.SalesInvoices
            .AsNoTracking()
            .Where(x =>
                x.InvoiceDateUtc <= effectiveAsOfUtc &&
                x.BalanceAmount > 0m &&
                x.Status != SalesInvoiceStatus.Rejected &&
                x.Status != SalesInvoiceStatus.Cancelled)
            .Select(x => new
            {
                x.Id,
                x.InvoiceNumber,
                x.InvoiceDateUtc,
                CustomerCode = x.Customer != null ? x.Customer.CustomerCode : string.Empty,
                CustomerName = x.Customer != null ? x.Customer.CustomerName : string.Empty,
                x.BalanceAmount,
                x.NetReceivableAmount,
                x.Status
            })
            .ToListAsync(cancellationToken);

        var result = rows
            .Select(x =>
            {
                var daysOutstanding = Math.Max(0, (int)(effectiveAsOfUtc.Date - x.InvoiceDateUtc.Date).TotalDays);
                var ageBucket = ResolveAgeBucket(daysOutstanding);
                var riskLevel = ResolveReceivableRiskLevel(daysOutstanding, x.BalanceAmount);

                return new
                {
                    x.Id,
                    x.InvoiceNumber,
                    x.InvoiceDateUtc,
                    x.CustomerCode,
                    x.CustomerName,
                    x.BalanceAmount,
                    x.NetReceivableAmount,
                    x.Status,
                    DaysOutstanding = daysOutstanding,
                    AgeBucket = ageBucket,
                    RiskLevel = riskLevel,
                    RecommendedAction = ResolveCollectionAction(daysOutstanding, x.BalanceAmount)
                };
            })
            .OrderByDescending(x => x.RiskLevel == "Critical")
            .ThenByDescending(x => x.RiskLevel == "High")
            .ThenByDescending(x => x.DaysOutstanding)
            .ThenByDescending(x => x.BalanceAmount)
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            AsOfUtc = effectiveAsOfUtc,
            Count = result.Count,
            TotalOutstandingAmount = result.Sum(x => x.BalanceAmount),
            CriticalCount = result.Count(x => x.RiskLevel == "Critical"),
            HighRiskCount = result.Count(x => x.RiskLevel == "High"),
            Items = result
        });
    }

    [Authorize(Policy = AuthorizationPolicies.ReportsView)]
    [HttpGet("payables-strategy")]
    public async Task<IActionResult> GetPayablesStrategy(
        [FromQuery] DateTime? asOfUtc,
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

        var effectiveAsOfUtc = asOfUtc ?? DateTime.UtcNow;

        var rows = await dbContext.PurchaseInvoices
            .AsNoTracking()
            .Where(x =>
                x.InvoiceDateUtc <= effectiveAsOfUtc &&
                x.BalanceAmount > 0m &&
                x.Status != PurchaseInvoiceStatus.Rejected &&
                x.Status != PurchaseInvoiceStatus.Cancelled)
            .Select(x => new
            {
                x.Id,
                x.InvoiceNumber,
                x.InvoiceDateUtc,
                VendorCode = x.Vendor != null ? x.Vendor.VendorCode : string.Empty,
                VendorName = x.Vendor != null ? x.Vendor.VendorName : string.Empty,
                x.BalanceAmount,
                x.NetPayableAmount,
                x.Status
            })
            .ToListAsync(cancellationToken);

        var result = rows
            .Select(x =>
            {
                var daysOutstanding = Math.Max(0, (int)(effectiveAsOfUtc.Date - x.InvoiceDateUtc.Date).TotalDays);
                var priority = ResolvePayablePriority(daysOutstanding, x.BalanceAmount);

                return new
                {
                    x.Id,
                    x.InvoiceNumber,
                    x.InvoiceDateUtc,
                    x.VendorCode,
                    x.VendorName,
                    x.BalanceAmount,
                    x.NetPayableAmount,
                    x.Status,
                    DaysOutstanding = daysOutstanding,
                    Priority = priority,
                    RecommendedAction = ResolvePaymentAction(daysOutstanding, x.BalanceAmount)
                };
            })
            .OrderByDescending(x => x.Priority == "Immediate")
            .ThenByDescending(x => x.Priority == "High")
            .ThenByDescending(x => x.DaysOutstanding)
            .ThenByDescending(x => x.BalanceAmount)
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            AsOfUtc = effectiveAsOfUtc,
            Count = result.Count,
            TotalOutstandingAmount = result.Sum(x => x.BalanceAmount),
            ImmediateCount = result.Count(x => x.Priority == "Immediate"),
            HighPriorityCount = result.Count(x => x.Priority == "High"),
            Items = result
        });
    }

    [Authorize(Policy = AuthorizationPolicies.ReportsView)]
    [HttpGet("actions")]
    public async Task<IActionResult> GetWorkingCapitalActions(
        [FromQuery] DateTime? asOfUtc,
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

        var effectiveAsOfUtc = asOfUtc ?? DateTime.UtcNow;

        var receivables = await dbContext.SalesInvoices
            .AsNoTracking()
            .Where(x =>
                x.InvoiceDateUtc <= effectiveAsOfUtc &&
                x.BalanceAmount > 0m &&
                x.Status != SalesInvoiceStatus.Rejected &&
                x.Status != SalesInvoiceStatus.Cancelled)
            .Select(x => new
            {
                x.InvoiceDateUtc,
                x.BalanceAmount
            })
            .ToListAsync(cancellationToken);

        var payables = await dbContext.PurchaseInvoices
            .AsNoTracking()
            .Where(x =>
                x.InvoiceDateUtc <= effectiveAsOfUtc &&
                x.BalanceAmount > 0m &&
                x.Status != PurchaseInvoiceStatus.Rejected &&
                x.Status != PurchaseInvoiceStatus.Cancelled)
            .Select(x => new
            {
                x.InvoiceDateUtc,
                x.BalanceAmount
            })
            .ToListAsync(cancellationToken);

        var stockValue = await dbContext.StockLedgerEntries
            .AsNoTracking()
            .Where(x => x.MovementDateUtc <= effectiveAsOfUtc)
            .SumAsync(x => (x.QuantityIn * x.UnitCost) - (x.QuantityOut * x.UnitCost), cancellationToken);

        var totalReceivables = receivables.Sum(x => x.BalanceAmount);
        var totalPayables = payables.Sum(x => x.BalanceAmount);

        var criticalReceivables = receivables.Count(x => (effectiveAsOfUtc.Date - x.InvoiceDateUtc.Date).TotalDays > 120 && x.BalanceAmount > 0m);
        var highReceivables = receivables.Count(x => (effectiveAsOfUtc.Date - x.InvoiceDateUtc.Date).TotalDays > 90 && x.BalanceAmount > 0m);
        var immediatePayables = payables.Count(x => (effectiveAsOfUtc.Date - x.InvoiceDateUtc.Date).TotalDays > 90 && x.BalanceAmount > 0m);

        var actions = new List<object>();

        if (criticalReceivables > 0)
        {
            actions.Add(new
            {
                Severity = "Critical",
                Area = "Receivables",
                Title = "Escalate critical overdue receivables",
                Description = $"{criticalReceivables} invoice(s) are older than 120 days. Escalate collection immediately.",
                RecommendedAction = "Call customer, issue demand notice, or place account on credit hold."
            });
        }

        if (highReceivables > 0)
        {
            actions.Add(new
            {
                Severity = "High",
                Area = "Receivables",
                Title = "Prioritize high-risk collections",
                Description = $"{highReceivables} invoice(s) are older than 90 days.",
                RecommendedAction = "Assign collection owner and agree payment commitment date."
            });
        }

        if (immediatePayables > 0)
        {
            actions.Add(new
            {
                Severity = "High",
                Area = "Payables",
                Title = "Review aged vendor obligations",
                Description = $"{immediatePayables} payable invoice(s) require immediate review.",
                RecommendedAction = "Prioritize strategic vendors and defer non-critical payments where appropriate."
            });
        }

        if (totalReceivables > totalPayables * 1.5m && totalReceivables > 0m)
        {
            actions.Add(new
            {
                Severity = "Moderate",
                Area = "Cash Conversion",
                Title = "Receivables are tying down working capital",
                Description = "Open receivables significantly exceed payables.",
                RecommendedAction = "Increase collection intensity before committing to discretionary cash outflows."
            });
        }

        if (stockValue > (totalReceivables + totalPayables) && stockValue > 0m)
        {
            actions.Add(new
            {
                Severity = "Moderate",
                Area = "Inventory",
                Title = "Inventory exposure is high",
                Description = "Inventory value is higher than combined open AR/AP exposure.",
                RecommendedAction = "Review slow-moving stock and reorder policy."
            });
        }

        if (actions.Count == 0)
        {
            actions.Add(new
            {
                Severity = "Healthy",
                Area = "Working Capital",
                Title = "Working capital position is stable",
                Description = "No urgent working capital exception was detected from the current dataset.",
                RecommendedAction = "Continue routine monitoring."
            });
        }

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            AsOfUtc = effectiveAsOfUtc,
            Count = actions.Count,
            Items = actions
        });
    }

    private static string ResolveAgeBucket(int daysOutstanding)
    {
        if (daysOutstanding <= 30) return "0-30";
        if (daysOutstanding <= 60) return "31-60";
        if (daysOutstanding <= 90) return "61-90";
        if (daysOutstanding <= 120) return "91-120";
        if (daysOutstanding <= 180) return "121-180";
        if (daysOutstanding <= 360) return "181-360";
        return "360+";
    }

    private static string ResolveReceivableRiskLevel(int daysOutstanding, decimal amount)
    {
        if (daysOutstanding > 180) return "Critical";
        if (daysOutstanding > 120) return "High";
        if (daysOutstanding > 90) return "High";
        if (daysOutstanding > 60) return "Moderate";
        return amount > 0m ? "Low" : "None";
    }

    private static string ResolveCollectionAction(int daysOutstanding, decimal amount)
    {
        if (amount <= 0m) return "No action required.";
        if (daysOutstanding > 180) return "Escalate to management and assess impairment.";
        if (daysOutstanding > 120) return "Issue demand notice and freeze additional credit.";
        if (daysOutstanding > 90) return "Call customer and agree immediate payment plan.";
        if (daysOutstanding > 60) return "Send reminder and assign collection follow-up.";
        return "Monitor under normal collection cycle.";
    }

    private static string ResolvePayablePriority(int daysOutstanding, decimal amount)
    {
        if (amount <= 0m) return "None";
        if (daysOutstanding > 120) return "Immediate";
        if (daysOutstanding > 90) return "Immediate";
        if (daysOutstanding > 60) return "High";
        if (daysOutstanding > 30) return "Medium";
        return "Low";
    }

    private static string ResolvePaymentAction(int daysOutstanding, decimal amount)
    {
        if (amount <= 0m) return "No action required.";
        if (daysOutstanding > 120) return "Review immediately and settle strategic suppliers first.";
        if (daysOutstanding > 90) return "Prioritize if supplier is operationally critical.";
        if (daysOutstanding > 60) return "Schedule payment based on cash availability.";
        if (daysOutstanding > 30) return "Monitor payment plan.";
        return "Keep under normal payable cycle.";
    }

    [Authorize(Policy = AuthorizationPolicies.ReportsView)]
    [HttpGet("cashflow-forecast")]
    public async Task<IActionResult> GetCashflowForecast(
        [FromQuery] DateTime? asOfUtc,
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

        var effectiveAsOfUtc = asOfUtc ?? DateTime.UtcNow;

        var openingCash = await dbContext.LedgerMovements
            .AsNoTracking()
            .Join(
                dbContext.LedgerAccounts.AsNoTracking(),
                movement => movement.LedgerAccountId,
                account => account.Id,
                (movement, account) => new
                {
                    account.IsCashOrBankAccount,
                    movement.MovementDateUtc,
                    movement.DebitAmount,
                    movement.CreditAmount
                })
            .Where(x => x.IsCashOrBankAccount && x.MovementDateUtc <= effectiveAsOfUtc)
            .SumAsync(x => x.DebitAmount - x.CreditAmount, cancellationToken);

        var receivables = await dbContext.SalesInvoices
            .AsNoTracking()
            .Where(x =>
                x.InvoiceDateUtc <= effectiveAsOfUtc &&
                x.BalanceAmount > 0m &&
                x.Status != SalesInvoiceStatus.Rejected &&
                x.Status != SalesInvoiceStatus.Cancelled)
            .Select(x => new
            {
                x.Id,
                x.InvoiceNumber,
                x.InvoiceDateUtc,
                CustomerCode = x.Customer != null ? x.Customer.CustomerCode : string.Empty,
                CustomerName = x.Customer != null ? x.Customer.CustomerName : string.Empty,
                x.BalanceAmount
            })
            .ToListAsync(cancellationToken);

        var payables = await dbContext.PurchaseInvoices
            .AsNoTracking()
            .Where(x =>
                x.InvoiceDateUtc <= effectiveAsOfUtc &&
                x.BalanceAmount > 0m &&
                x.Status != PurchaseInvoiceStatus.Rejected &&
                x.Status != PurchaseInvoiceStatus.Cancelled)
            .Select(x => new
            {
                x.Id,
                x.InvoiceNumber,
                x.InvoiceDateUtc,
                VendorCode = x.Vendor != null ? x.Vendor.VendorCode : string.Empty,
                VendorName = x.Vendor != null ? x.Vendor.VendorName : string.Empty,
                x.BalanceAmount
            })
            .ToListAsync(cancellationToken);

        var bucketDefinitions = new[]
        {
            new ForecastBucketDefinition("0-30", 0, 30),
            new ForecastBucketDefinition("31-60", 31, 60),
            new ForecastBucketDefinition("61-90", 61, 90)
        };

        var buckets = new List<object>();
        var receiptForecastItems = new List<object>();
        var paymentForecastItems = new List<object>();

        var runningCash = openingCash;

        foreach (var bucket in bucketDefinitions)
        {
            var expectedInflows = 0m;
            var expectedOutflows = 0m;

            foreach (var invoice in receivables)
            {
                var daysOutstanding = Math.Max(0, (int)(effectiveAsOfUtc.Date - invoice.InvoiceDateUtc.Date).TotalDays);
                var forecastDay = ResolveCollectionForecastDay(daysOutstanding);
                var probability = ResolveCollectionProbability(daysOutstanding);

                if (forecastDay >= bucket.StartDay && forecastDay <= bucket.EndDay)
                {
                    var expectedAmount = Math.Round(invoice.BalanceAmount * probability, 2);
                    expectedInflows += expectedAmount;

                    receiptForecastItems.Add(new
                    {
                        invoice.Id,
                        Reference = invoice.InvoiceNumber,
                        PartyCode = invoice.CustomerCode,
                        PartyName = invoice.CustomerName,
                        SourceType = "Receivable",
                        invoice.InvoiceDateUtc,
                        OutstandingAmount = invoice.BalanceAmount,
                        DaysOutstanding = daysOutstanding,
                        ForecastBucket = bucket.Label,
                        ForecastDay = forecastDay,
                        ProbabilityPercent = Math.Round(probability * 100m, 2),
                        ExpectedAmount = expectedAmount,
                        Recommendation = ResolveCollectionAction(daysOutstanding, invoice.BalanceAmount)
                    });
                }
            }

            foreach (var invoice in payables)
            {
                var daysOutstanding = Math.Max(0, (int)(effectiveAsOfUtc.Date - invoice.InvoiceDateUtc.Date).TotalDays);
                var forecastDay = ResolvePaymentForecastDay(daysOutstanding);
                var probability = ResolvePaymentProbability(daysOutstanding);

                if (forecastDay >= bucket.StartDay && forecastDay <= bucket.EndDay)
                {
                    var expectedAmount = Math.Round(invoice.BalanceAmount * probability, 2);
                    expectedOutflows += expectedAmount;

                    paymentForecastItems.Add(new
                    {
                        invoice.Id,
                        Reference = invoice.InvoiceNumber,
                        PartyCode = invoice.VendorCode,
                        PartyName = invoice.VendorName,
                        SourceType = "Payable",
                        invoice.InvoiceDateUtc,
                        OutstandingAmount = invoice.BalanceAmount,
                        DaysOutstanding = daysOutstanding,
                        ForecastBucket = bucket.Label,
                        ForecastDay = forecastDay,
                        ProbabilityPercent = Math.Round(probability * 100m, 2),
                        ExpectedAmount = expectedAmount,
                        Recommendation = ResolvePaymentAction(daysOutstanding, invoice.BalanceAmount)
                    });
                }
            }

            var netCashFlow = expectedInflows - expectedOutflows;
            runningCash += netCashFlow;

            buckets.Add(new
            {
                Bucket = bucket.Label,
                bucket.StartDay,
                bucket.EndDay,
                ExpectedInflows = expectedInflows,
                ExpectedOutflows = expectedOutflows,
                NetCashFlow = netCashFlow,
                ProjectedClosingCash = runningCash,
                RiskLevel = ResolveCashflowRiskLevel(runningCash, netCashFlow)
            });
        }

        var projectedClosingCash = runningCash;
        var totalExpectedInflows = receiptForecastItems.Sum(x => (decimal)x.GetType().GetProperty("ExpectedAmount")!.GetValue(x)!);
        var totalExpectedOutflows = paymentForecastItems.Sum(x => (decimal)x.GetType().GetProperty("ExpectedAmount")!.GetValue(x)!);
        var forecastRiskLevel = ResolveCashflowRiskLevel(projectedClosingCash, totalExpectedInflows - totalExpectedOutflows);

        var alerts = new List<object>();

        if (openingCash < 0m)
        {
            alerts.Add(new
            {
                Severity = "Critical",
                Title = "Opening cash is negative",
                Description = "Cash/bank balance is already negative as of the forecast date.",
                RecommendedAction = "Review bank position, collections, and urgent funding requirement."
            });
        }

        if (projectedClosingCash < 0m)
        {
            alerts.Add(new
            {
                Severity = "Critical",
                Title = "Projected cash deficit",
                Description = "The 90-day forecast projects a negative cash position.",
                RecommendedAction = "Accelerate collections, defer non-critical payments, and consider short-term financing."
            });
        }

        if (totalExpectedOutflows > totalExpectedInflows + openingCash)
        {
            alerts.Add(new
            {
                Severity = "High",
                Title = "Outflows exceed available cash and forecast inflows",
                Description = "Expected payments are higher than the available liquidity base.",
                RecommendedAction = "Prioritize strategic suppliers and reschedule discretionary payments."
            });
        }

        if (receiptForecastItems.Count == 0 && receivables.Count > 0)
        {
            alerts.Add(new
            {
                Severity = "Moderate",
                Title = "Receivables are not expected to convert within 90 days",
                Description = "Open receivables exist, but collection probability places them outside the 90-day forecast.",
                RecommendedAction = "Escalate collection follow-up and review credit terms."
            });
        }

        if (alerts.Count == 0)
        {
            alerts.Add(new
            {
                Severity = "Healthy",
                Title = "Forecast liquidity position is stable",
                Description = "No critical 90-day liquidity alert was detected.",
                RecommendedAction = "Continue monitoring collections, payments, and cash conversion cycle."
            });
        }

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            AsOfUtc = effectiveAsOfUtc,
            OpeningCash = openingCash,
            TotalExpectedInflows = totalExpectedInflows,
            TotalExpectedOutflows = totalExpectedOutflows,
            NetForecastCashFlow = totalExpectedInflows - totalExpectedOutflows,
            ProjectedClosingCash = projectedClosingCash,
            RiskLevel = forecastRiskLevel,
            Buckets = buckets,
            ReceiptForecastItems = receiptForecastItems
                .OrderBy(x => x.GetType().GetProperty("ForecastDay")!.GetValue(x))
                .ThenByDescending(x => x.GetType().GetProperty("ExpectedAmount")!.GetValue(x))
                .ToList(),
            PaymentForecastItems = paymentForecastItems
                .OrderBy(x => x.GetType().GetProperty("ForecastDay")!.GetValue(x))
                .ThenByDescending(x => x.GetType().GetProperty("ExpectedAmount")!.GetValue(x))
                .ToList(),
            Alerts = alerts
        });
    }

    private sealed record ForecastBucketDefinition(string Label, int StartDay, int EndDay);

    private static int ResolveCollectionForecastDay(int daysOutstanding)
    {
        if (daysOutstanding <= 30) return 15;
        if (daysOutstanding <= 60) return 30;
        if (daysOutstanding <= 90) return 45;
        if (daysOutstanding <= 120) return 60;
        if (daysOutstanding <= 180) return 90;
        return 120;
    }

    private static decimal ResolveCollectionProbability(int daysOutstanding)
    {
        if (daysOutstanding <= 30) return 0.80m;
        if (daysOutstanding <= 60) return 0.60m;
        if (daysOutstanding <= 90) return 0.40m;
        if (daysOutstanding <= 120) return 0.25m;
        if (daysOutstanding <= 180) return 0.15m;
        return 0.05m;
    }

    private static int ResolvePaymentForecastDay(int daysOutstanding)
    {
        if (daysOutstanding > 120) return 7;
        if (daysOutstanding > 90) return 15;
        if (daysOutstanding > 60) return 30;
        if (daysOutstanding > 30) return 60;
        return 90;
    }

    private static decimal ResolvePaymentProbability(int daysOutstanding)
    {
        if (daysOutstanding > 120) return 1.00m;
        if (daysOutstanding > 90) return 0.90m;
        if (daysOutstanding > 60) return 0.75m;
        if (daysOutstanding > 30) return 0.50m;
        return 0.35m;
    }

    private static string ResolveCashflowRiskLevel(decimal projectedCash, decimal netCashFlow)
    {
        if (projectedCash < 0m) return "Critical";
        if (netCashFlow < 0m && projectedCash < Math.Abs(netCashFlow)) return "High";
        if (netCashFlow < 0m) return "Moderate";
        return "Healthy";
    }

    [Authorize(Policy = AuthorizationPolicies.ReportsView)]
    [HttpGet("optimization")]
    public async Task<IActionResult> GetWorkingCapitalOptimization(
        [FromQuery] DateTime? asOfUtc,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required." });
        }

        var effectiveAsOfUtc = asOfUtc ?? DateTime.UtcNow;

        var receivables = await dbContext.SalesInvoices
            .AsNoTracking()
            .Where(x => x.BalanceAmount > 0m)
            .Select(x => new
            {
                x.Id,
                x.InvoiceNumber,
                x.InvoiceDateUtc,
                x.BalanceAmount
            })
            .ToListAsync(cancellationToken);

        var payables = await dbContext.PurchaseInvoices
            .AsNoTracking()
            .Where(x => x.BalanceAmount > 0m)
            .Select(x => new
            {
                x.Id,
                x.InvoiceNumber,
                x.InvoiceDateUtc,
                x.BalanceAmount
            })
            .ToListAsync(cancellationToken);

        var collectionPlan = receivables
            .Select(x =>
            {
                var days = Math.Max(0, (int)(effectiveAsOfUtc.Date - x.InvoiceDateUtc.Date).TotalDays);

                return new
                {
                    x.Id,
                    x.InvoiceNumber,
                    x.BalanceAmount,
                    DaysOutstanding = days,
                    Priority =
                        days > 120 ? "Critical" :
                        days > 90 ? "High" :
                        days > 60 ? "Moderate" : "Normal",
                    RecommendedAction =
                        days > 120 ? "Escalate immediately" :
                        days > 90 ? "Legal / recovery follow-up" :
                        days > 60 ? "Aggressive follow-up" :
                        "Standard reminder"
                };
            })
            .OrderByDescending(x => x.Priority == "Critical")
            .ThenByDescending(x => x.Priority == "High")
            .ThenByDescending(x => x.BalanceAmount)
            .Take(20)
            .ToList();

        var paymentPlan = payables
            .Select(x =>
            {
                var days = Math.Max(0, (int)(effectiveAsOfUtc.Date - x.InvoiceDateUtc.Date).TotalDays);

                return new
                {
                    x.Id,
                    x.InvoiceNumber,
                    x.BalanceAmount,
                    DaysOutstanding = days,
                    Priority =
                        days > 120 ? "Immediate" :
                        days > 90 ? "High" :
                        days > 60 ? "Moderate" : "Normal",
                    RecommendedAction =
                        days > 120 ? "Pay immediately (supplier risk)" :
                        days > 90 ? "Schedule payment urgently" :
                        days > 60 ? "Plan payment" :
                        "Defer strategically"
                };
            })
            .OrderByDescending(x => x.Priority == "Immediate")
            .ThenByDescending(x => x.Priority == "High")
            .ThenByDescending(x => x.BalanceAmount)
            .Take(20)
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            AsOfUtc = effectiveAsOfUtc,
            CollectionPlan = collectionPlan,
            PaymentPlan = paymentPlan
        });
    }
}
