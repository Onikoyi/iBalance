using iBalance.BuildingBlocks.Application.Security;
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
[Route("api/finance/ap")]
public sealed class AccountsPayableController : ControllerBase
{
    [HttpGet("vendors")]
    public async Task<IActionResult> GetVendors(
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

        var items = await dbContext.Vendors
            .AsNoTracking()
            .OrderBy(x => x.VendorName)
            .ThenBy(x => x.VendorCode)
            .Select(x => new
            {
                x.Id,
                x.VendorCode,
                x.VendorName,
                x.Email,
                x.PhoneNumber,
                x.BillingAddress,
                x.IsActive,
                x.CreatedOnUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpGet("vendors/{vendorId:guid}/statement")]
    public async Task<IActionResult> GetVendorStatement(
        Guid vendorId,
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

        var vendor = await dbContext.Vendors
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == vendorId, cancellationToken);

        if (vendor is null)
        {
            return NotFound(new
            {
                Message = "Vendor was not found for the current tenant.",
                VendorId = vendorId
            });
        }

        var purchaseInvoicesQuery = dbContext.PurchaseInvoices
            .AsNoTracking()
            .Where(x => x.VendorId == vendorId);

        var vendorPaymentsQuery = dbContext.VendorPayments
            .AsNoTracking()
            .Where(x => x.VendorId == vendorId);

        if (fromUtc.HasValue)
        {
            purchaseInvoicesQuery = purchaseInvoicesQuery.Where(x => x.InvoiceDateUtc >= fromUtc.Value);
            vendorPaymentsQuery = vendorPaymentsQuery.Where(x => x.PaymentDateUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            purchaseInvoicesQuery = purchaseInvoicesQuery.Where(x => x.InvoiceDateUtc <= toUtc.Value);
            vendorPaymentsQuery = vendorPaymentsQuery.Where(x => x.PaymentDateUtc <= toUtc.Value);
        }

        var invoices = await purchaseInvoicesQuery
            .OrderBy(x => x.InvoiceDateUtc)
            .ThenBy(x => x.InvoiceNumber)
            .Select(x => new
            {
                Type = "Invoice",
                DateUtc = x.InvoiceDateUtc,
                Reference = x.InvoiceNumber,
                x.Description,
                DebitAmount = 0m,
                CreditAmount = x.NetPayableAmount > 0m ? x.NetPayableAmount : x.TotalAmount,
                InvoiceAmount = x.NetPayableAmount > 0m ? x.NetPayableAmount : x.TotalAmount,
                BaseAmount = x.TotalAmount,
                TaxAdditionAmount = x.TaxAdditionAmount,
                TaxDeductionAmount = x.TaxDeductionAmount,
                GrossAmount = x.GrossAmount > 0m ? x.GrossAmount : x.TotalAmount,
                NetPayableAmount = x.NetPayableAmount > 0m ? x.NetPayableAmount : x.TotalAmount,
                PaymentAmount = 0m,
                BalanceImpact = x.NetPayableAmount > 0m ? x.NetPayableAmount : x.TotalAmount,
                x.Status
            })
            .ToListAsync(cancellationToken);

        var payments = await vendorPaymentsQuery
            .OrderBy(x => x.PaymentDateUtc)
            .ThenBy(x => x.PaymentNumber)
            .Select(x => new
            {
                Type = "Payment",
                DateUtc = x.PaymentDateUtc,
                Reference = x.PaymentNumber,
                x.Description,
                DebitAmount = x.Amount,
                CreditAmount = 0m,
                InvoiceAmount = 0m,
                BaseAmount = 0m,
                TaxAdditionAmount = 0m,
                TaxDeductionAmount = 0m,
                GrossAmount = 0m,
                NetPayableAmount = 0m,
                PaymentAmount = x.Amount,
                BalanceImpact = -x.Amount,
                x.Status
            })
            .ToListAsync(cancellationToken);

        var statementItems = invoices
            .Cast<dynamic>()
            .Concat(payments.Cast<dynamic>())
            .OrderBy(x => x.DateUtc)
            .ThenBy(x => x.Reference)
            .ToList();

        decimal runningBalance = 0m;

        var items = statementItems.Select(x =>
        {
            runningBalance += (decimal)x.BalanceImpact;

           return new
                    {
                        x.Type,
                        x.DateUtc,
                        x.Reference,
                        x.Description,
                        x.DebitAmount,
                        x.CreditAmount,
                        x.InvoiceAmount,
                        x.BaseAmount,
                        x.TaxAdditionAmount,
                        x.TaxDeductionAmount,
                        x.GrossAmount,
                        x.NetPayableAmount,
                        x.PaymentAmount,
                        RunningBalance = runningBalance,
                        x.Status
                    };
        }).ToList();

        var totalBaseAmount = invoices.Sum(x => x.BaseAmount);
        var totalTaxAdditions = invoices.Sum(x => x.TaxAdditionAmount);
        var totalTaxDeductions = invoices.Sum(x => x.TaxDeductionAmount);
        var totalGrossAmount = invoices.Sum(x => x.GrossAmount);
        var totalInvoiced = invoices.Sum(x => x.InvoiceAmount);
        var totalPaid = payments.Sum(x => x.PaymentAmount);
        var closingBalance = totalInvoiced - totalPaid;

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Vendor = new
            {
                vendor.Id,
                vendor.VendorCode,
                vendor.VendorName,
                vendor.Email,
                vendor.PhoneNumber,
                vendor.BillingAddress,
                vendor.IsActive
            },
            FromUtc = fromUtc,
            ToUtc = toUtc,
            TotalInvoices = invoices.Count,
            TotalPayments = payments.Count,
            TotalBaseAmount = totalBaseAmount,
            TotalTaxAdditions = totalTaxAdditions,
            TotalTaxDeductions = totalTaxDeductions,
            TotalGrossAmount = totalGrossAmount,
            TotalInvoiced = totalInvoiced,
            TotalPaid = totalPaid,
            ClosingBalance = closingBalance,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("vendors")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> CreateVendor(
        [FromBody] CreateVendorRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
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

        if (string.IsNullOrWhiteSpace(request.VendorCode))
        {
            return BadRequest(new { Message = "Vendor code is required." });
        }

        if (string.IsNullOrWhiteSpace(request.VendorName))
        {
            return BadRequest(new { Message = "Vendor name is required." });
        }

        var normalizedCode = request.VendorCode.Trim().ToUpperInvariant();

        var exists = await dbContext.Vendors
            .AnyAsync(x => x.VendorCode == normalizedCode, cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A vendor with the same code already exists." });
        }

        var vendor = new Vendor(
            Guid.NewGuid(),
            tenantContext.TenantId,
            normalizedCode,
            request.VendorName,
            request.Email,
            request.PhoneNumber,
            request.BillingAddress,
            request.IsActive);

        vendor.SetAudit(currentUserService.UserId, currentUserService.UserId);

        dbContext.Vendors.Add(vendor);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Vendor created successfully.",
            Vendor = new
            {
                vendor.Id,
                vendor.VendorCode,
                vendor.VendorName,
                vendor.Email,
                vendor.PhoneNumber,
                vendor.BillingAddress,
                vendor.IsActive
            }
        });
    }

    [HttpGet("purchase-invoices")]
    public async Task<IActionResult> GetPurchaseInvoices(
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

        var items = await dbContext.PurchaseInvoices
            .AsNoTracking()
            .Include(x => x.Vendor)
            .Include(x => x.Lines)
            .OrderByDescending(x => x.InvoiceDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .Select(x => new
            {
                x.Id,
                x.VendorId,
                VendorCode = x.Vendor != null ? x.Vendor.VendorCode : string.Empty,
                VendorName = x.Vendor != null ? x.Vendor.VendorName : string.Empty,
                x.InvoiceDateUtc,
                x.InvoiceNumber,
                x.Description,
                x.Status,
                x.TotalAmount,
                x.TaxAdditionAmount,
                x.TaxDeductionAmount,
                x.GrossAmount,
                x.NetPayableAmount,
                x.AmountPaid,
                x.BalanceAmount,
                x.JournalEntryId,
                x.PostedOnUtc,
                LineCount = x.Lines.Count
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("purchase-invoices")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> CreatePurchaseInvoice(
        [FromBody] CreatePurchaseInvoiceRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
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

        if (request.VendorId == Guid.Empty)
        {
            return BadRequest(new { Message = "Vendor is required." });
        }

        if (string.IsNullOrWhiteSpace(request.InvoiceNumber))
        {
            return BadRequest(new { Message = "Invoice number is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new { Message = "Invoice description is required." });
        }

        if (request.Lines is null || request.Lines.Count == 0)
        {
            return BadRequest(new { Message = "At least one purchase invoice line is required." });
        }

        var vendor = await dbContext.Vendors
            .FirstOrDefaultAsync(x => x.Id == request.VendorId, cancellationToken);

        if (vendor is null)
        {
            return NotFound(new { Message = "The selected vendor was not found." });
        }

        if (!vendor.IsActive)
        {
            return BadRequest(new { Message = "The selected vendor is inactive." });
        }

        var normalizedInvoiceNumber = request.InvoiceNumber.Trim().ToUpperInvariant();

        var exists = await dbContext.PurchaseInvoices
            .AnyAsync(x => x.InvoiceNumber == normalizedInvoiceNumber, cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A purchase invoice with the same number already exists." });
        }

        var invoice = new PurchaseInvoice(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.VendorId,
            request.InvoiceDateUtc,
            normalizedInvoiceNumber,
            request.Description);

        invoice.SetAudit(currentUserService.UserId, currentUserService.UserId);

        foreach (var line in request.Lines)
        {
            if (string.IsNullOrWhiteSpace(line.Description))
            {
                return BadRequest(new { Message = "Each purchase invoice line must have a description." });
            }

            if (line.Quantity <= 0)
            {
                return BadRequest(new { Message = "Each purchase invoice line quantity must be greater than zero." });
            }

            if (line.UnitPrice < 0)
            {
                return BadRequest(new { Message = "Purchase invoice line unit price cannot be negative." });
            }

            var invoiceLine = new PurchaseInvoiceLine(
                Guid.NewGuid(),
                tenantContext.TenantId,
                invoice.Id,
                line.Description,
                line.Quantity,
                line.UnitPrice);

            invoiceLine.SetAudit(currentUserService.UserId, currentUserService.UserId);
            invoice.Lines.Add(invoiceLine);
        }

                // invoice.RecalculateTotals();

        var selectedTaxCodeIds = request.TaxCodeIds?
            .Where(x => x != Guid.Empty)
            .Distinct()
            .ToList() ?? [];

        var purchaseInvoiceTaxLines = new List<PurchaseInvoiceTaxLine>();

        if (selectedTaxCodeIds.Count > 0)
        {
            var taxCodes = await dbContext.TaxCodes
                .AsNoTracking()
                .Where(x => selectedTaxCodeIds.Contains(x.Id))
                .OrderBy(x => x.ComponentKind)
                .ThenBy(x => x.Code)
                .ToListAsync(cancellationToken);

            if (taxCodes.Count != selectedTaxCodeIds.Count)
            {
                return BadRequest(new { Message = "One or more selected tax codes were not found." });
            }

            var taxableAmount = request.Lines.Sum(x => x.Quantity * x.UnitPrice);

            foreach (var taxCode in taxCodes)
            {
                if (!taxCode.IsActive)
                {
                    return BadRequest(new
                    {
                        Message = "Only active tax codes can be used on a purchase invoice.",
                        TaxCodeId = taxCode.Id,
                        taxCode.Code
                    });
                }

                if (!taxCode.IsEffectiveOn(request.InvoiceDateUtc))
                {
                    return BadRequest(new
                    {
                        Message = "One or more selected tax codes are not effective for the invoice date.",
                        TaxCodeId = taxCode.Id,
                        taxCode.Code,
                        taxCode.EffectiveFromUtc,
                        taxCode.EffectiveToUtc,
                        request.InvoiceDateUtc
                    });
                }

                if (taxCode.TransactionScope != TaxTransactionScope.Both &&
                    taxCode.TransactionScope != TaxTransactionScope.Purchases)
                {
                    return BadRequest(new
                    {
                        Message = "One or more selected tax codes cannot be used for purchase invoices.",
                        TaxCodeId = taxCode.Id,
                        taxCode.Code,
                        taxCode.TransactionScope
                    });
                }

                var taxAmount = taxCode.CalculateTaxAmount(taxableAmount);

                purchaseInvoiceTaxLines.Add(new PurchaseInvoiceTaxLine(
                    Guid.NewGuid(),
                    invoice.Id,
                    taxCode.Id,
                    taxCode.ComponentKind,
                    taxCode.ApplicationMode,
                    taxCode.TransactionScope,
                    taxCode.RatePercent,
                    taxableAmount,
                    taxAmount,
                    taxCode.TaxLedgerAccountId,
                    $"{taxCode.Code} - {taxCode.Name}"));
            }
        }

            var totalTaxAdditions = purchaseInvoiceTaxLines
            .Where(x => x.ApplicationMode == TaxApplicationMode.AddToAmount)
            .Sum(x => x.TaxAmount);

        var totalTaxDeductions = purchaseInvoiceTaxLines
            .Where(x => x.ApplicationMode == TaxApplicationMode.DeductFromAmount)
            .Sum(x => x.TaxAmount);

        invoice.RecalculateTotals(totalTaxAdditions, totalTaxDeductions);

        dbContext.PurchaseInvoices.Add(invoice);

        if (purchaseInvoiceTaxLines.Count > 0)
        {
            dbContext.PurchaseInvoiceTaxLines.AddRange(purchaseInvoiceTaxLines);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        //         var totalTaxAdditions = purchaseInvoiceTaxLines
        //     .Where(x => x.ApplicationMode == TaxApplicationMode.AddToAmount)
        //     .Sum(x => x.TaxAmount);

        // var totalTaxDeductions = purchaseInvoiceTaxLines
        //     .Where(x => x.ApplicationMode == TaxApplicationMode.DeductFromAmount)
        //     .Sum(x => x.TaxAmount);

        return Ok(new
        {
            Message = "Purchase invoice created successfully.",
            Invoice = new
            {
                invoice.Id,
                invoice.InvoiceNumber,
                invoice.Description,
                invoice.InvoiceDateUtc,
                invoice.Status,
                invoice.TotalAmount,
                invoice.AmountPaid,
                invoice.BalanceAmount,
                TaxLineCount = purchaseInvoiceTaxLines.Count,
                TotalTaxAdditions = totalTaxAdditions,
                TotalTaxDeductions = totalTaxDeductions,
                invoice.GrossAmount,
                invoice.NetPayableAmount
            }
        });
    }

      [HttpPost("purchase-invoices/{purchaseInvoiceId:guid}/post")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> PostPurchaseInvoice(
        Guid purchaseInvoiceId,
        [FromBody] PostPurchaseInvoiceRequest request,
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

        if (request.PayableLedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Payable ledger account is required." });
        }

        if (request.ExpenseLedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Expense ledger account is required." });
        }

        var invoice = await dbContext.PurchaseInvoices
            .Include(x => x.Vendor)
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == purchaseInvoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new
            {
                Message = "Purchase invoice was not found for the current tenant.",
                PurchaseInvoiceId = purchaseInvoiceId
            });
        }

        if (invoice.Status != PurchaseInvoiceStatus.Draft)
        {
            return Conflict(new
            {
                Message = "Only draft purchase invoices can be posted.",
                PurchaseInvoiceId = purchaseInvoiceId,
                invoice.Status
            });
        }

        if (invoice.TotalAmount <= 0m)
        {
            return Conflict(new
            {
                Message = "Only purchase invoices with a positive total amount can be posted.",
                PurchaseInvoiceId = purchaseInvoiceId,
                invoice.TotalAmount
            });
        }

        var purchaseInvoiceTaxLines = await dbContext.PurchaseInvoiceTaxLines
            .AsNoTracking()
            .Where(x => x.PurchaseInvoiceId == invoice.Id)
            .OrderBy(x => x.ComponentKind)
            .ThenBy(x => x.TaxCodeId)
            .ToListAsync(cancellationToken);

        var totalTaxAdditions = purchaseInvoiceTaxLines
            .Where(x => x.ApplicationMode == TaxApplicationMode.AddToAmount)
            .Sum(x => x.TaxAmount);

        var totalTaxDeductions = purchaseInvoiceTaxLines
            .Where(x => x.ApplicationMode == TaxApplicationMode.DeductFromAmount)
            .Sum(x => x.TaxAmount);

        var grossInvoiceAmount = invoice.TotalAmount + totalTaxAdditions;
        var netPayableAmount = grossInvoiceAmount - totalTaxDeductions;

        if (netPayableAmount <= 0m)
        {
            return Conflict(new
            {
                Message = "Purchase invoice net payable amount must be greater than zero after tax additions and deductions.",
                PurchaseInvoiceId = purchaseInvoiceId,
                invoice.TotalAmount,
                TotalTaxAdditions = totalTaxAdditions,
                TotalTaxDeductions = totalTaxDeductions,
                NetPayableAmount = netPayableAmount
            });
        }

        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(
            dbContext,
            invoice.InvoiceDateUtc,
            cancellationToken);

        if (postingPeriod is null)
        {
            return Conflict(new
            {
                Message = "No open fiscal period exists for the purchase invoice posting date.",
                PostingDateUtc = invoice.InvoiceDateUtc
            });
        }

        var requestedLedgerAccountIds = new[]
            {
                request.PayableLedgerAccountId,
                request.ExpenseLedgerAccountId
            }
            .Concat(purchaseInvoiceTaxLines.Select(x => x.TaxLedgerAccountId))
            .Distinct()
            .ToList();

        var ledgerAccounts = await dbContext.LedgerAccounts
            .Where(x => requestedLedgerAccountIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        if (ledgerAccounts.Count != requestedLedgerAccountIds.Count)
        {
            return BadRequest(new
            {
                Message = "One or more selected ledger accounts were not found for the current tenant."
            });
        }

        var payableAccount = ledgerAccounts[request.PayableLedgerAccountId];
        var expenseAccount = ledgerAccounts[request.ExpenseLedgerAccountId];

        if (!IsPostingReady(payableAccount))
        {
            return BadRequest(new
            {
                Message = "The payable ledger account must be active, non-header, and posting-enabled.",
                payableAccount.Id,
                payableAccount.Code
            });
        }

        if (!IsPostingReady(expenseAccount))
        {
            return BadRequest(new
            {
                Message = "The expense ledger account must be active, non-header, and posting-enabled.",
                expenseAccount.Id,
                expenseAccount.Code
            });
        }

        foreach (var taxLine in purchaseInvoiceTaxLines)
        {
            var taxLedgerAccount = ledgerAccounts[taxLine.TaxLedgerAccountId];

            if (!IsPostingReady(taxLedgerAccount))
            {
                return BadRequest(new
                {
                    Message = "Each tax ledger account must be active, non-header, and posting-enabled.",
                    taxLedgerAccount.Id,
                    taxLedgerAccount.Code
                });
            }
        }

        var reference = $"AP-{invoice.InvoiceNumber}";

        var referenceExists = await dbContext.JournalEntries
            .AsNoTracking()
            .AnyAsync(x => x.Reference == reference, cancellationToken);

        if (referenceExists)
        {
            return Conflict(new
            {
                Message = "A journal entry with the generated purchase invoice posting reference already exists.",
                Reference = reference
            });
        }

        var vendorName = invoice.Vendor?.VendorName ?? "Vendor";

        var journalLines = new List<JournalEntryLine>
        {
            new(
                Guid.NewGuid(),
                expenseAccount.Id,
                $"Expense recognition - {invoice.InvoiceNumber}",
                invoice.TotalAmount,
                0m)
        };

        foreach (var taxLine in purchaseInvoiceTaxLines.Where(x => x.ApplicationMode == TaxApplicationMode.AddToAmount))
        {
            journalLines.Add(new JournalEntryLine(
                Guid.NewGuid(),
                taxLine.TaxLedgerAccountId,
                $"Purchase tax addition - {invoice.InvoiceNumber} - {taxLine.Description}",
                taxLine.TaxAmount,
                0m));
        }

        foreach (var taxLine in purchaseInvoiceTaxLines.Where(x => x.ApplicationMode == TaxApplicationMode.DeductFromAmount))
        {
            journalLines.Add(new JournalEntryLine(
                Guid.NewGuid(),
                taxLine.TaxLedgerAccountId,
                $"Purchase tax deduction - {invoice.InvoiceNumber} - {taxLine.Description}",
                0m,
                taxLine.TaxAmount));
        }

        journalLines.Add(new JournalEntryLine(
            Guid.NewGuid(),
            payableAccount.Id,
            $"Accounts payable - {invoice.InvoiceNumber}",
            0m,
            netPayableAmount));

        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            invoice.InvoiceDateUtc,
            reference,
            $"Purchase invoice posting - {invoice.InvoiceNumber} - {vendorName}",
            JournalEntryStatus.Draft,
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

        var taxTransactionLines = purchaseInvoiceTaxLines
            .Select(taxLine => new TaxTransactionLine(
                Guid.NewGuid(),
                tenantContext.TenantId,
                taxLine.TaxCodeId,
                invoice.InvoiceDateUtc,
                "AP",
                "PurchaseInvoice",
                invoice.Id,
                invoice.InvoiceNumber,
                taxLine.TaxableAmount,
                taxLine.TaxAmount,
                taxLine.ComponentKind,
                taxLine.ApplicationMode,
                taxLine.TransactionScope,
                taxLine.RatePercent,
                taxLine.TaxLedgerAccountId,
                invoice.VendorId,
                invoice.Vendor?.VendorCode,
                invoice.Vendor?.VendorName,
                taxLine.Description,
                journalEntry.Id))
            .ToList();

        invoice.RecalculateTotals(totalTaxAdditions, totalTaxDeductions);
        invoice.MarkPosted(journalEntry.Id);

        dbContext.JournalEntries.Add(journalEntry);
        dbContext.LedgerMovements.AddRange(movements);

        if (taxTransactionLines.Count > 0)
        {
            dbContext.TaxTransactionLines.AddRange(taxTransactionLines);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Purchase invoice posted successfully.",
            Invoice = new
            {
                invoice.Id,
                invoice.InvoiceNumber,
                invoice.Status,
                invoice.TotalAmount,
                invoice.AmountPaid,
                invoice.BalanceAmount,
                TaxLineCount = purchaseInvoiceTaxLines.Count,
                TotalTaxAdditions = totalTaxAdditions,
                TotalTaxDeductions = totalTaxDeductions,
                GrossInvoiceAmount = grossInvoiceAmount,
                NetPayableAmount = netPayableAmount,
                invoice.JournalEntryId,
                invoice.PostedOnUtc
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

    [HttpGet("vendor-payments")]
    public async Task<IActionResult> GetVendorPayments(
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

        var payments = await dbContext.VendorPayments
            .AsNoTracking()
            .Include(x => x.Vendor)
            .Include(x => x.PurchaseInvoice)
            .OrderByDescending(x => x.PaymentDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);

        var userNames = await GetUserDisplayNamesAsync(
            dbContext,
            payments.SelectMany(payment => new[]
            {
                payment.CreatedBy,
                payment.LastModifiedBy,
                payment.SubmittedBy,
                payment.ApprovedBy,
                payment.RejectedBy
            }),
            cancellationToken);

        var items = payments.Select(x => new
        {
            x.Id,
            x.VendorId,
            VendorCode = x.Vendor != null ? x.Vendor.VendorCode : string.Empty,
            VendorName = x.Vendor != null ? x.Vendor.VendorName : string.Empty,
            x.PurchaseInvoiceId,
            InvoiceNumber = x.PurchaseInvoice != null ? x.PurchaseInvoice.InvoiceNumber : string.Empty,
            x.PaymentDateUtc,
            x.PaymentNumber,
            x.Description,
            x.Amount,
            x.Status,
            x.PostingRequiresApproval,
            x.SubmittedBy,
            SubmittedByDisplayName = ResolveUserDisplayName(x.SubmittedBy, userNames),
            x.SubmittedOnUtc,
            x.ApprovedBy,
            ApprovedByDisplayName = ResolveUserDisplayName(x.ApprovedBy, userNames),
            x.ApprovedOnUtc,
            x.RejectedBy,
            RejectedByDisplayName = ResolveUserDisplayName(x.RejectedBy, userNames),
            x.RejectedOnUtc,
            x.RejectionReason,
            x.CreatedOnUtc,
            x.CreatedBy,
            CreatedByDisplayName = ResolveUserDisplayName(x.CreatedBy, userNames),
            PreparedByDisplayName = ResolveUserDisplayName(x.CreatedBy, userNames),
            x.LastModifiedOnUtc,
            x.LastModifiedBy,
            LastModifiedByDisplayName = ResolveUserDisplayName(x.LastModifiedBy, userNames),
            x.JournalEntryId,
            x.PostedOnUtc
        }).ToList();

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpGet("vendor-payments/{vendorPaymentId:guid}")]
    public async Task<IActionResult> GetVendorPaymentDetail(
        Guid vendorPaymentId,
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

        var payment = await dbContext.VendorPayments
            .AsNoTracking()
            .Include(x => x.Vendor)
            .Include(x => x.PurchaseInvoice)
                .ThenInclude(x => x!.Lines)
            .FirstOrDefaultAsync(x => x.Id == vendorPaymentId, cancellationToken);

        if (payment is null)
        {
            return NotFound(new
            {
                Message = "Vendor payment was not found for the current tenant.",
                VendorPaymentId = vendorPaymentId
            });
        }

        var userNames = await GetUserDisplayNamesAsync(
            dbContext,
            new[]
            {
                payment.CreatedBy,
                payment.LastModifiedBy,
                payment.SubmittedBy,
                payment.ApprovedBy,
                payment.RejectedBy
            },
            cancellationToken);

        var createdByDisplayName = ResolveUserDisplayName(payment.CreatedBy, userNames);
        var lastModifiedByDisplayName = ResolveUserDisplayName(payment.LastModifiedBy, userNames);
        var submittedByDisplayName = ResolveUserDisplayName(payment.SubmittedBy, userNames);
        var approvedByDisplayName = ResolveUserDisplayName(payment.ApprovedBy, userNames);
        var rejectedByDisplayName = ResolveUserDisplayName(payment.RejectedBy, userNames);

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Payment = new
            {
                payment.Id,
                payment.VendorId,
                VendorCode = payment.Vendor != null ? payment.Vendor.VendorCode : string.Empty,
                VendorName = payment.Vendor != null ? payment.Vendor.VendorName : string.Empty,
                VendorEmail = payment.Vendor != null ? payment.Vendor.Email : null,
                VendorPhoneNumber = payment.Vendor != null ? payment.Vendor.PhoneNumber : null,
                VendorBillingAddress = payment.Vendor != null ? payment.Vendor.BillingAddress : null,
                payment.PurchaseInvoiceId,
                InvoiceNumber = payment.PurchaseInvoice != null ? payment.PurchaseInvoice.InvoiceNumber : string.Empty,
                InvoiceDescription = payment.PurchaseInvoice != null ? payment.PurchaseInvoice.Description : string.Empty,
                InvoiceDateUtc = payment.PurchaseInvoice != null ? payment.PurchaseInvoice.InvoiceDateUtc : (DateTime?)null,
                InvoiceTotalAmount = payment.PurchaseInvoice != null ? payment.PurchaseInvoice.TotalAmount : 0m,
                InvoiceTaxAdditionAmount = payment.PurchaseInvoice != null ? payment.PurchaseInvoice.TaxAdditionAmount : 0m,
                InvoiceTaxDeductionAmount = payment.PurchaseInvoice != null ? payment.PurchaseInvoice.TaxDeductionAmount : 0m,
                InvoiceGrossAmount = payment.PurchaseInvoice != null ? payment.PurchaseInvoice.GrossAmount : 0m,
                InvoiceNetPayableAmount = payment.PurchaseInvoice != null ? payment.PurchaseInvoice.NetPayableAmount : 0m,
                InvoiceAmountPaid = payment.PurchaseInvoice != null ? payment.PurchaseInvoice.AmountPaid : 0m,
                InvoiceBalanceAmount = payment.PurchaseInvoice != null ? payment.PurchaseInvoice.BalanceAmount : 0m,
                payment.PaymentDateUtc,
                payment.PaymentNumber,
                payment.Description,
                payment.Amount,
                payment.Status,
                payment.PostingRequiresApproval,
                payment.SubmittedBy,
                SubmittedByDisplayName = submittedByDisplayName,
                payment.SubmittedOnUtc,
                payment.ApprovedBy,
                ApprovedByDisplayName = approvedByDisplayName,
                payment.ApprovedOnUtc,
                payment.RejectedBy,
                RejectedByDisplayName = rejectedByDisplayName,
                payment.RejectedOnUtc,
                payment.RejectionReason,
                payment.JournalEntryId,
                payment.PostedOnUtc,
                payment.CreatedOnUtc,
                payment.CreatedBy,
                CreatedByDisplayName = createdByDisplayName,
                PreparedByDisplayName = createdByDisplayName,
                payment.LastModifiedOnUtc,
                payment.LastModifiedBy,
                LastModifiedByDisplayName = lastModifiedByDisplayName,
                InvoiceLines = payment.PurchaseInvoice != null
                    ? payment.PurchaseInvoice.Lines
                        .OrderBy(x => x.CreatedOnUtc)
                        .Select(x => (object)new
                        {
                            x.Id,
                            x.Description,
                            x.Quantity,
                            x.UnitPrice,
                            x.LineTotal
                        })
                        .ToList()
                    : new List<object>()
            }
        });
    }

    [HttpPost("vendor-payments")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> CreateVendorPayment(
        [FromBody] CreateVendorPaymentRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
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

        if (request.VendorId == Guid.Empty)
        {
            return BadRequest(new { Message = "Vendor is required." });
        }

        if (request.PurchaseInvoiceId == Guid.Empty)
        {
            return BadRequest(new { Message = "Purchase invoice is required." });
        }

        if (string.IsNullOrWhiteSpace(request.PaymentNumber))
        {
            return BadRequest(new { Message = "Payment number is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new { Message = "Payment description is required." });
        }

        if (request.Amount <= 0m)
        {
            return BadRequest(new { Message = "Payment amount must be greater than zero." });
        }

        var vendor = await dbContext.Vendors
            .FirstOrDefaultAsync(x => x.Id == request.VendorId, cancellationToken);

        if (vendor is null)
        {
            return NotFound(new { Message = "The selected vendor was not found." });
        }

        var invoice = await dbContext.PurchaseInvoices
            .FirstOrDefaultAsync(x => x.Id == request.PurchaseInvoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new { Message = "The selected purchase invoice was not found." });
        }

        if (invoice.VendorId != request.VendorId)
        {
            return BadRequest(new { Message = "The selected purchase invoice does not belong to the selected vendor." });
        }

        if (invoice.Status != PurchaseInvoiceStatus.Posted && invoice.Status != PurchaseInvoiceStatus.PartPaid)
        {
            return BadRequest(new { Message = "Only posted or part-paid purchase invoices can receive vendor payments." });
        }

               var taxAwareBalanceAmount = await GetPurchaseInvoiceTaxAwareBalanceAsync(
            dbContext,
            invoice,
            cancellationToken);

        if (request.Amount > taxAwareBalanceAmount)
        {
            return BadRequest(new
            {
                Message = "Payment amount cannot exceed the outstanding tax-adjusted purchase invoice balance.",
                InvoiceNumber = invoice.InvoiceNumber,
                invoice.TotalAmount,
                invoice.AmountPaid,
                BaseBalanceAmount = invoice.BalanceAmount,
                TaxAdjustedBalanceAmount = taxAwareBalanceAmount,
                RequestedPaymentAmount = request.Amount
            });
        }

        var normalizedPaymentNumber = request.PaymentNumber.Trim().ToUpperInvariant();

        var exists = await dbContext.VendorPayments
            .AnyAsync(x => x.PaymentNumber == normalizedPaymentNumber, cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A vendor payment with the same number already exists." });
        }

        var payment = new VendorPayment(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.VendorId,
            request.PurchaseInvoiceId,
            request.PaymentDateUtc,
            normalizedPaymentNumber,
            request.Description,
            request.Amount);

        payment.SetAudit(currentUserService.UserId, currentUserService.UserId);

        dbContext.VendorPayments.Add(payment);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Vendor payment created successfully.",
            Payment = new
            {
                payment.Id,
                payment.PaymentNumber,
                payment.Description,
                payment.PaymentDateUtc,
                payment.Amount,
                payment.Status,
                payment.PostingRequiresApproval
            }
        });
    }

    [HttpPost("vendor-payments/{vendorPaymentId:guid}/submit")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> SubmitVendorPaymentForApproval(
        Guid vendorPaymentId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
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

        var payment = await dbContext.VendorPayments
            .FirstOrDefaultAsync(x => x.Id == vendorPaymentId, cancellationToken);

        if (payment is null)
        {
            return NotFound(new
            {
                Message = "Vendor payment was not found for the current tenant.",
                VendorPaymentId = vendorPaymentId
            });
        }

        var submittedByUserId = EnsureAuthenticatedUserId(currentUserService);

        try
        {
            payment.SubmitForApproval(submittedByUserId);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new
            {
                Message = ex.Message,
                VendorPaymentId = vendorPaymentId,
                payment.Status
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Vendor payment submitted for approval successfully.",
            Payment = new
            {
                payment.Id,
                payment.PaymentNumber,
                payment.Status,
                payment.SubmittedBy,
                payment.SubmittedOnUtc,
                payment.PostingRequiresApproval
            }
        });
    }

    [HttpPost("vendor-payments/{vendorPaymentId:guid}/approve")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Approver")]
    public async Task<IActionResult> ApproveVendorPayment(
        Guid vendorPaymentId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
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

        var payment = await dbContext.VendorPayments
            .FirstOrDefaultAsync(x => x.Id == vendorPaymentId, cancellationToken);

        if (payment is null)
        {
            return NotFound(new
            {
                Message = "Vendor payment was not found for the current tenant.",
                VendorPaymentId = vendorPaymentId
            });
        }

        var approvedByUserId = EnsureAuthenticatedUserId(currentUserService);

        try
        {
            payment.Approve(approvedByUserId);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new
            {
                Message = ex.Message,
                VendorPaymentId = vendorPaymentId,
                payment.Status
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Vendor payment approved successfully.",
            Payment = new
            {
                payment.Id,
                payment.PaymentNumber,
                payment.Status,
                payment.ApprovedBy,
                payment.ApprovedOnUtc
            }
        });
    }

    [HttpPost("vendor-payments/{vendorPaymentId:guid}/reject")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Approver")]
    public async Task<IActionResult> RejectVendorPayment(
        Guid vendorPaymentId,
        [FromBody] RejectVendorPaymentRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
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

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { Message = "Rejection reason is required." });
        }

        var payment = await dbContext.VendorPayments
            .FirstOrDefaultAsync(x => x.Id == vendorPaymentId, cancellationToken);

        if (payment is null)
        {
            return NotFound(new
            {
                Message = "Vendor payment was not found for the current tenant.",
                VendorPaymentId = vendorPaymentId
            });
        }

        var rejectedByUserId = EnsureAuthenticatedUserId(currentUserService);

        try
        {
            payment.Reject(rejectedByUserId, request.Reason);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new
            {
                Message = ex.Message,
                VendorPaymentId = vendorPaymentId,
                payment.Status
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Vendor payment rejected successfully.",
            Payment = new
            {
                payment.Id,
                payment.PaymentNumber,
                payment.Status,
                payment.RejectedBy,
                payment.RejectedOnUtc,
                payment.RejectionReason
            }
        });
    }

    [HttpPost("vendor-payments/{vendorPaymentId:guid}/post")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Approver")]
    public async Task<IActionResult> PostVendorPayment(
        Guid vendorPaymentId,
        [FromBody] PostVendorPaymentRequest request,
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

        if (request.CashOrBankLedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Cash or bank ledger account is required." });
        }

        if (request.PayableLedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Payable ledger account is required." });
        }

        var payment = await dbContext.VendorPayments
            .Include(x => x.Vendor)
            .Include(x => x.PurchaseInvoice)
            .FirstOrDefaultAsync(x => x.Id == vendorPaymentId, cancellationToken);

        if (payment is null)
        {
            return NotFound(new
            {
                Message = "Vendor payment was not found for the current tenant.",
                VendorPaymentId = vendorPaymentId
            });
        }

        var requiredPostingStatus = payment.PostingRequiresApproval
            ? VendorPaymentStatus.Approved
            : VendorPaymentStatus.Draft;

        if (payment.Status != requiredPostingStatus)
        {
            return Conflict(new
            {
                Message = payment.PostingRequiresApproval
                    ? "Only approved vendor payments can be posted."
                    : "Only draft vendor payments can be posted.",
                VendorPaymentId = vendorPaymentId,
                payment.Status
            });
        }

        if (payment.Amount <= 0m)
        {
            return Conflict(new
            {
                Message = "Only vendor payments with a positive amount can be posted.",
                VendorPaymentId = vendorPaymentId,
                payment.Amount
            });
        }

        var invoice = await dbContext.PurchaseInvoices
            .FirstOrDefaultAsync(x => x.Id == payment.PurchaseInvoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new { Message = "The linked purchase invoice was not found." });
        }

        if (invoice.Status != PurchaseInvoiceStatus.Posted && invoice.Status != PurchaseInvoiceStatus.PartPaid)
        {
            return Conflict(new { Message = "The linked purchase invoice is not eligible for payment posting." });
        }

               var taxAwareBalanceAmount = await GetPurchaseInvoiceTaxAwareBalanceAsync(
            dbContext,
            invoice,
            cancellationToken);

        if (payment.Amount > taxAwareBalanceAmount)
        {
            return Conflict(new
            {
                Message = "Payment amount cannot exceed the outstanding tax-adjusted purchase invoice balance.",
                InvoiceNumber = invoice.InvoiceNumber,
                invoice.TotalAmount,
                invoice.AmountPaid,
                BaseBalanceAmount = invoice.BalanceAmount,
                TaxAdjustedBalanceAmount = taxAwareBalanceAmount,
                PaymentAmount = payment.Amount
            });
        }

        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(
            dbContext,
            payment.PaymentDateUtc,
            cancellationToken);

        if (postingPeriod is null)
        {
            return Conflict(new
            {
                Message = "No open fiscal period exists for the vendor payment posting date.",
                PostingDateUtc = payment.PaymentDateUtc
            });
        }

        var requestedLedgerAccountIds = new[]
        {
            request.CashOrBankLedgerAccountId,
            request.PayableLedgerAccountId
        };

        var ledgerAccounts = await dbContext.LedgerAccounts
            .Where(x => requestedLedgerAccountIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        if (ledgerAccounts.Count != requestedLedgerAccountIds.Length)
        {
            return BadRequest(new
            {
                Message = "One or more selected ledger accounts were not found for the current tenant."
            });
        }

        var cashOrBankAccount = ledgerAccounts[request.CashOrBankLedgerAccountId];
        var payableAccount = ledgerAccounts[request.PayableLedgerAccountId];

        if (!IsPostingReady(cashOrBankAccount))
        {
            return BadRequest(new
            {
                Message = "The cash or bank ledger account must be active, non-header, and posting-enabled.",
                cashOrBankAccount.Id,
                cashOrBankAccount.Code
            });
        }

        if (!IsPostingReady(payableAccount))
        {
            return BadRequest(new
            {
                Message = "The payable ledger account must be active, non-header, and posting-enabled.",
                payableAccount.Id,
                payableAccount.Code
            });
        }

        var reference = $"PAY-{payment.PaymentNumber}";

        var referenceExists = await dbContext.JournalEntries
            .AsNoTracking()
            .AnyAsync(x => x.Reference == reference, cancellationToken);

        if (referenceExists)
        {
            return Conflict(new
            {
                Message = "A journal entry with the generated vendor payment posting reference already exists.",
                Reference = reference
            });
        }

        var vendorName = payment.Vendor?.VendorName ?? "Vendor";
        var invoiceNumber = payment.PurchaseInvoice?.InvoiceNumber ?? "Invoice";

        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            payment.PaymentDateUtc,
            reference,
            $"Vendor payment posting - {payment.PaymentNumber} - {vendorName} - {invoiceNumber}",
            JournalEntryStatus.Draft,
            JournalEntryType.Normal,
            new[]
            {
                new JournalEntryLine(
                    Guid.NewGuid(),
                    payableAccount.Id,
                    $"Accounts payable settlement - {invoiceNumber}",
                    payment.Amount,
                    0m),
                new JournalEntryLine(
                    Guid.NewGuid(),
                    cashOrBankAccount.Id,
                    $"Vendor payment - {payment.PaymentNumber}",
                    0m,
                    payment.Amount)
            });

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

        payment.MarkPosted(journalEntry.Id);
        invoice.ApplyPayment(payment.Amount);

        dbContext.JournalEntries.Add(journalEntry);
        dbContext.LedgerMovements.AddRange(movements);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Vendor payment posted successfully.",
            Payment = new
            {
                payment.Id,
                payment.PaymentNumber,
                payment.Status,
                payment.Amount,
                payment.JournalEntryId,
                payment.PostedOnUtc
            },
            Invoice = new
            {
                invoice.Id,
                invoice.InvoiceNumber,
                invoice.Status,
                invoice.TotalAmount,
                invoice.AmountPaid,
                invoice.BalanceAmount,
                TaxAdjustedBalanceAmount = Math.Max(0m, taxAwareBalanceAmount - payment.Amount)
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

    private static bool IsPostingReady(LedgerAccount ledgerAccount)
    {
        return ledgerAccount.IsActive &&
               !ledgerAccount.IsHeader &&
               ledgerAccount.IsPostingAllowed;
    }


    private static async Task<decimal> GetPurchaseInvoiceTaxAwareBalanceAsync(
        ApplicationDbContext dbContext,
        PurchaseInvoice invoice,
        CancellationToken cancellationToken)
    {
        var taxLines = await dbContext.PurchaseInvoiceTaxLines
            .AsNoTracking()
            .Where(x => x.PurchaseInvoiceId == invoice.Id)
            .Select(x => new
            {
                x.ApplicationMode,
                x.TaxAmount
            })
            .ToListAsync(cancellationToken);

        var totalTaxAdditions = taxLines
            .Where(x => x.ApplicationMode == TaxApplicationMode.AddToAmount)
            .Sum(x => x.TaxAmount);

        var totalTaxDeductions = taxLines
            .Where(x => x.ApplicationMode == TaxApplicationMode.DeductFromAmount)
            .Sum(x => x.TaxAmount);

        var netPayableAmount = invoice.TotalAmount + totalTaxAdditions - totalTaxDeductions;

        return netPayableAmount - invoice.AmountPaid;
    }



    private static async Task<FiscalPeriod?> GetOpenFiscalPeriodForDateAsync(
        ApplicationDbContext dbContext,
        DateTime dateUtc,
        CancellationToken cancellationToken)
    {
        var postingDate = DateOnly.FromDateTime(dateUtc.Date);

        return await dbContext.FiscalPeriods
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.Status == FiscalPeriodStatus.Open &&
                     x.StartDate <= postingDate &&
                     x.EndDate >= postingDate,
                cancellationToken);
    }

    private static async Task<Dictionary<Guid, string>> GetUserDisplayNamesAsync(
        ApplicationDbContext dbContext,
        IEnumerable<string?> rawUserIds,
        CancellationToken cancellationToken)
    {
        var userIds = rawUserIds
            .Where(value => !string.IsNullOrWhiteSpace(value) && Guid.TryParse(value, out _))
            .Select(value => Guid.Parse(value!))
            .Distinct()
            .ToList();

        if (userIds.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        return await dbContext.UserAccounts
            .AsNoTracking()
            .Where(x => userIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.FullName, cancellationToken);
    }

    private static string? ResolveUserDisplayName(
        string? rawUserId,
        IReadOnlyDictionary<Guid, string> userNames)
    {
        if (!Guid.TryParse(rawUserId, out var userId))
        {
            return string.IsNullOrWhiteSpace(rawUserId) ? null : rawUserId;
        }

        return userNames.TryGetValue(userId, out var displayName)
            ? displayName
            : rawUserId;
    }

    private static string EnsureAuthenticatedUserId(ICurrentUserService currentUserService)
    {
        if (string.IsNullOrWhiteSpace(currentUserService.UserId))
        {
            throw new InvalidOperationException("Authenticated user context is required.");
        }

        return currentUserService.UserId.Trim();
    }

    public sealed record CreateVendorRequest(
        string VendorCode,
        string VendorName,
        string? Email,
        string? PhoneNumber,
        string? BillingAddress,
        bool IsActive);

    public sealed record CreatePurchaseInvoiceLineRequest(
        string Description,
        decimal Quantity,
        decimal UnitPrice);

    public sealed record CreatePurchaseInvoiceRequest(
    Guid VendorId,
    DateTime InvoiceDateUtc,
    string InvoiceNumber,
    string Description,
    List<CreatePurchaseInvoiceLineRequest> Lines,
    List<Guid>? TaxCodeIds);

    public sealed record PostPurchaseInvoiceRequest(
        Guid PayableLedgerAccountId,
        Guid ExpenseLedgerAccountId);

    public sealed record CreateVendorPaymentRequest(
        Guid VendorId,
        Guid PurchaseInvoiceId,
        DateTime PaymentDateUtc,
        string PaymentNumber,
        string Description,
        decimal Amount);

    public sealed record PostVendorPaymentRequest(
        Guid CashOrBankLedgerAccountId,
        Guid PayableLedgerAccountId);

    public sealed record RejectVendorPaymentRequest(
        string Reason);
}