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
                CreditAmount = x.TotalAmount,
                InvoiceAmount = x.TotalAmount,
                PaymentAmount = 0m,
                BalanceImpact = x.TotalAmount,
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
                x.PaymentAmount,
                RunningBalance = runningBalance,
                x.Status
            };
        }).ToList();

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

        invoice.RecalculateTotals();

        dbContext.PurchaseInvoices.Add(invoice);
        await dbContext.SaveChangesAsync(cancellationToken);

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
                invoice.BalanceAmount
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
        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            invoice.InvoiceDateUtc,
            reference,
            $"Purchase invoice posting - {invoice.InvoiceNumber} - {vendorName}",
            JournalEntryStatus.Draft,
            JournalEntryType.Normal,
            new[]
            {
                new JournalEntryLine(
                    Guid.NewGuid(),
                    expenseAccount.Id,
                    $"Expense recognition - {invoice.InvoiceNumber}",
                    invoice.TotalAmount,
                    0m),
                new JournalEntryLine(
                    Guid.NewGuid(),
                    payableAccount.Id,
                    $"Accounts payable - {invoice.InvoiceNumber}",
                    0m,
                    invoice.TotalAmount)
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

        invoice.MarkPosted(journalEntry.Id);

        dbContext.JournalEntries.Add(journalEntry);
        dbContext.LedgerMovements.AddRange(movements);

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

        var items = await dbContext.VendorPayments
            .AsNoTracking()
            .Include(x => x.Vendor)
            .Include(x => x.PurchaseInvoice)
            .OrderByDescending(x => x.PaymentDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .Select(x => new
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
                x.JournalEntryId,
                x.PostedOnUtc
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

        var auditUserIds = new List<Guid>();

        if (TryParseUserId(payment.CreatedBy, out var createdByUserId))
        {
            auditUserIds.Add(createdByUserId);
        }

        if (TryParseUserId(payment.LastModifiedBy, out var lastModifiedByUserId))
        {
            auditUserIds.Add(lastModifiedByUserId);
        }

        var userNames = auditUserIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await dbContext.UserAccounts
                .AsNoTracking()
                .Where(x => auditUserIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.FullName, cancellationToken);

        var createdByDisplayName = ResolveUserDisplayName(payment.CreatedBy, userNames);
        var lastModifiedByDisplayName = ResolveUserDisplayName(payment.LastModifiedBy, userNames);

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
                InvoiceAmountPaid = payment.PurchaseInvoice != null ? payment.PurchaseInvoice.AmountPaid : 0m,
                InvoiceBalanceAmount = payment.PurchaseInvoice != null ? payment.PurchaseInvoice.BalanceAmount : 0m,
                payment.PaymentDateUtc,
                payment.PaymentNumber,
                payment.Description,
                payment.Amount,
                payment.Status,
                payment.JournalEntryId,
                payment.PostedOnUtc,
                payment.CreatedOnUtc,
                payment.CreatedBy,
                CreatedByDisplayName = createdByDisplayName,
                PreparedByDisplayName = createdByDisplayName,
                payment.LastModifiedOnUtc,
                payment.LastModifiedBy,
                LastModifiedByDisplayName = lastModifiedByDisplayName,
                ApprovedByDisplayName = (string?)null,
                ApprovedOnUtc = (DateTime?)null,
                InvoiceLines = (payment.PurchaseInvoice != null
                    ? payment.PurchaseInvoice.Lines
                        .OrderBy(x => x.CreatedOnUtc)
                        .Select(x => new
                        {
                            x.Id,
                            x.Description,
                            x.Quantity,
                            x.UnitPrice,
                            x.LineTotal
                        })
                    : Enumerable.Empty<object>()
                        .Select(_ => new
                        {
                            Id = Guid.Empty,
                            Description = string.Empty,
                            Quantity = 0m,
                            UnitPrice = 0m,
                            LineTotal = 0m
                        }))
                    .ToList()
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

        if (request.Amount > invoice.BalanceAmount)
        {
            return BadRequest(new { Message = "Payment amount cannot exceed the outstanding invoice balance." });
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
                payment.Status
            }
        });
    }

    [HttpPost("vendor-payments/{vendorPaymentId:guid}/post")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
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

        if (payment.Status != VendorPaymentStatus.Draft)
        {
            return Conflict(new
            {
                Message = "Only draft vendor payments can be posted.",
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

        if (payment.Amount > invoice.BalanceAmount)
        {
            return Conflict(new { Message = "Payment amount cannot exceed the outstanding invoice balance." });
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
                invoice.BalanceAmount
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

    private static bool TryParseUserId(string? rawUserId, out Guid userId)
    {
        return Guid.TryParse(rawUserId, out userId);
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
        List<CreatePurchaseInvoiceLineRequest> Lines);

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
}