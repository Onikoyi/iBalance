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
[Route("api/finance/ar")]
public sealed class AccountsReceivableController : ControllerBase
{
    [HttpGet("customers")]
    public async Task<IActionResult> GetCustomers(
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

        var items = await dbContext.Customers
            .AsNoTracking()
            .OrderBy(x => x.CustomerName)
            .ThenBy(x => x.CustomerCode)
            .Select(x => new
            {
                x.Id,
                x.CustomerCode,
                x.CustomerName,
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

    [HttpPost("customers")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> CreateCustomer(
        [FromBody] CreateCustomerRequest request,
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

        if (string.IsNullOrWhiteSpace(request.CustomerCode))
        {
            return BadRequest(new { Message = "Customer code is required." });
        }

        if (string.IsNullOrWhiteSpace(request.CustomerName))
        {
            return BadRequest(new { Message = "Customer name is required." });
        }

        var normalizedCode = request.CustomerCode.Trim().ToUpperInvariant();

        var exists = await dbContext.Customers
            .AnyAsync(x => x.CustomerCode == normalizedCode, cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A customer with the same code already exists." });
        }

        var customer = new Customer(
            Guid.NewGuid(),
            tenantContext.TenantId,
            normalizedCode,
            request.CustomerName,
            request.Email,
            request.PhoneNumber,
            request.BillingAddress,
            request.IsActive);

        customer.SetAudit(currentUserService.UserId, currentUserService.UserId);

        dbContext.Customers.Add(customer);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Customer created successfully.",
            Customer = new
            {
                customer.Id,
                customer.CustomerCode,
                customer.CustomerName,
                customer.Email,
                customer.PhoneNumber,
                customer.BillingAddress,
                customer.IsActive
            }
        });
    }

    [HttpGet("sales-invoices")]
    public async Task<IActionResult> GetSalesInvoices(
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

        var items = await dbContext.SalesInvoices
            .AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Lines)
            .OrderByDescending(x => x.InvoiceDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .Select(x => new
            {
                x.Id,
                x.CustomerId,
                CustomerCode = x.Customer != null ? x.Customer.CustomerCode : string.Empty,
                CustomerName = x.Customer != null ? x.Customer.CustomerName : string.Empty,
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

    [HttpPost("sales-invoices")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> CreateSalesInvoice(
        [FromBody] CreateSalesInvoiceRequest request,
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

        if (request.CustomerId == Guid.Empty)
        {
            return BadRequest(new { Message = "Customer is required." });
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
            return BadRequest(new { Message = "At least one invoice line is required." });
        }

        var customer = await dbContext.Customers
            .FirstOrDefaultAsync(x => x.Id == request.CustomerId, cancellationToken);

        if (customer is null)
        {
            return NotFound(new { Message = "The selected customer was not found." });
        }

        if (!customer.IsActive)
        {
            return BadRequest(new { Message = "The selected customer is inactive." });
        }

        var normalizedInvoiceNumber = request.InvoiceNumber.Trim().ToUpperInvariant();

        var exists = await dbContext.SalesInvoices
            .AnyAsync(x => x.InvoiceNumber == normalizedInvoiceNumber, cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A sales invoice with the same number already exists." });
        }

        var invoice = new SalesInvoice(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.CustomerId,
            request.InvoiceDateUtc,
            normalizedInvoiceNumber,
            request.Description);

        invoice.SetAudit(currentUserService.UserId, currentUserService.UserId);

        foreach (var line in request.Lines)
        {
            if (string.IsNullOrWhiteSpace(line.Description))
            {
                return BadRequest(new { Message = "Each invoice line must have a description." });
            }

            if (line.Quantity <= 0)
            {
                return BadRequest(new { Message = "Each invoice line quantity must be greater than zero." });
            }

            if (line.UnitPrice < 0)
            {
                return BadRequest(new { Message = "Invoice line unit price cannot be negative." });
            }

            var invoiceLine = new SalesInvoiceLine(
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

        dbContext.SalesInvoices.Add(invoice);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Sales invoice created successfully.",
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

    [HttpPost("sales-invoices/{salesInvoiceId:guid}/post")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> PostSalesInvoice(
        Guid salesInvoiceId,
        [FromBody] PostSalesInvoiceRequest request,
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

        if (request.ReceivableLedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Receivable ledger account is required." });
        }

        if (request.RevenueLedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Revenue ledger account is required." });
        }

        var invoice = await dbContext.SalesInvoices
            .Include(x => x.Customer)
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == salesInvoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new
            {
                Message = "Sales invoice was not found for the current tenant.",
                SalesInvoiceId = salesInvoiceId
            });
        }

        if (invoice.Status != SalesInvoiceStatus.Draft)
        {
            return Conflict(new
            {
                Message = "Only draft sales invoices can be posted.",
                SalesInvoiceId = salesInvoiceId,
                invoice.Status
            });
        }

        if (invoice.TotalAmount <= 0m)
        {
            return Conflict(new
            {
                Message = "Only invoices with a positive total amount can be posted.",
                SalesInvoiceId = salesInvoiceId,
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
                Message = "No open fiscal period exists for the invoice posting date.",
                PostingDateUtc = invoice.InvoiceDateUtc
            });
        }

        var requestedLedgerAccountIds = new[]
        {
            request.ReceivableLedgerAccountId,
            request.RevenueLedgerAccountId
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

        var receivableAccount = ledgerAccounts[request.ReceivableLedgerAccountId];
        var revenueAccount = ledgerAccounts[request.RevenueLedgerAccountId];

        if (!IsPostingReady(receivableAccount))
        {
            return BadRequest(new
            {
                Message = "The receivable ledger account must be active, non-header, and posting-enabled.",
                receivableAccount.Id,
                receivableAccount.Code
            });
        }

        if (!IsPostingReady(revenueAccount))
        {
            return BadRequest(new
            {
                Message = "The revenue ledger account must be active, non-header, and posting-enabled.",
                revenueAccount.Id,
                revenueAccount.Code
            });
        }

        var reference = $"AR-{invoice.InvoiceNumber}";

        var referenceExists = await dbContext.JournalEntries
            .AsNoTracking()
            .AnyAsync(x => x.Reference == reference, cancellationToken);

        if (referenceExists)
        {
            return Conflict(new
            {
                Message = "A journal entry with the generated invoice posting reference already exists.",
                Reference = reference
            });
        }

        var customerName = invoice.Customer?.CustomerName ?? "Customer";
        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            invoice.InvoiceDateUtc,
            reference,
            $"Sales invoice posting - {invoice.InvoiceNumber} - {customerName}",
            JournalEntryStatus.Draft,
            JournalEntryType.Normal,
            new[]
            {
                new JournalEntryLine(
                    Guid.NewGuid(),
                    receivableAccount.Id,
                    $"Accounts receivable - {invoice.InvoiceNumber}",
                    invoice.TotalAmount,
                    0m),
                new JournalEntryLine(
                    Guid.NewGuid(),
                    revenueAccount.Id,
                    $"Revenue - {invoice.InvoiceNumber}",
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
            Message = "Sales invoice posted successfully.",
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

    [HttpGet("customer-receipts")]
    public async Task<IActionResult> GetCustomerReceipts(
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

        var receipts = await dbContext.CustomerReceipts
            .AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.SalesInvoice)
            .OrderByDescending(x => x.ReceiptDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);

        var userNames = await GetUserDisplayNamesAsync(
            dbContext,
            receipts.SelectMany(receipt => new[]
            {
                receipt.CreatedBy,
                receipt.LastModifiedBy,
                receipt.SubmittedBy,
                receipt.ApprovedBy,
                receipt.RejectedBy
            }),
            cancellationToken);

        var items = receipts.Select(x => new
        {
            x.Id,
            x.CustomerId,
            CustomerCode = x.Customer != null ? x.Customer.CustomerCode : string.Empty,
            CustomerName = x.Customer != null ? x.Customer.CustomerName : string.Empty,
            x.SalesInvoiceId,
            InvoiceNumber = x.SalesInvoice != null ? x.SalesInvoice.InvoiceNumber : string.Empty,
            x.ReceiptDateUtc,
            x.ReceiptNumber,
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

    [HttpGet("customer-receipts/{customerReceiptId:guid}")]
    public async Task<IActionResult> GetCustomerReceiptDetail(
        Guid customerReceiptId,
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

        var receipt = await dbContext.CustomerReceipts
            .AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.SalesInvoice)
            .FirstOrDefaultAsync(x => x.Id == customerReceiptId, cancellationToken);

        if (receipt is null)
        {
            return NotFound(new
            {
                Message = "Customer receipt was not found for the current tenant.",
                CustomerReceiptId = customerReceiptId
            });
        }

        var invoice = await dbContext.SalesInvoices
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == receipt.SalesInvoiceId, cancellationToken);

        var userNames = await GetUserDisplayNamesAsync(
            dbContext,
            new[]
            {
                receipt.CreatedBy,
                receipt.LastModifiedBy,
                receipt.SubmittedBy,
                receipt.ApprovedBy,
                receipt.RejectedBy
            },
            cancellationToken);

        var createdByDisplayName = ResolveUserDisplayName(receipt.CreatedBy, userNames);
        var lastModifiedByDisplayName = ResolveUserDisplayName(receipt.LastModifiedBy, userNames);
        var submittedByDisplayName = ResolveUserDisplayName(receipt.SubmittedBy, userNames);
        var approvedByDisplayName = ResolveUserDisplayName(receipt.ApprovedBy, userNames);
        var rejectedByDisplayName = ResolveUserDisplayName(receipt.RejectedBy, userNames);

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Receipt = new
            {
                receipt.Id,
                receipt.CustomerId,
                CustomerCode = receipt.Customer?.CustomerCode ?? string.Empty,
                CustomerName = receipt.Customer?.CustomerName ?? string.Empty,
                CustomerEmail = receipt.Customer?.Email,
                CustomerPhoneNumber = receipt.Customer?.PhoneNumber,
                CustomerBillingAddress = receipt.Customer?.BillingAddress,
                receipt.SalesInvoiceId,
                InvoiceNumber = receipt.SalesInvoice?.InvoiceNumber ?? string.Empty,
                InvoiceDescription = receipt.SalesInvoice?.Description ?? string.Empty,
                InvoiceDateUtc = receipt.SalesInvoice?.InvoiceDateUtc,
                InvoiceTotalAmount = receipt.SalesInvoice?.TotalAmount ?? 0m,
                InvoiceAmountPaid = receipt.SalesInvoice?.AmountPaid ?? 0m,
                InvoiceBalanceAmount = receipt.SalesInvoice?.BalanceAmount ?? 0m,
                receipt.ReceiptDateUtc,
                receipt.ReceiptNumber,
                receipt.Description,
                receipt.Amount,
                receipt.Status,
                receipt.PostingRequiresApproval,
                receipt.SubmittedBy,
                SubmittedByDisplayName = submittedByDisplayName,
                receipt.SubmittedOnUtc,
                receipt.ApprovedBy,
                ApprovedByDisplayName = approvedByDisplayName,
                receipt.ApprovedOnUtc,
                receipt.RejectedBy,
                RejectedByDisplayName = rejectedByDisplayName,
                receipt.RejectedOnUtc,
                receipt.RejectionReason,
                receipt.JournalEntryId,
                receipt.PostedOnUtc,
                receipt.CreatedOnUtc,
                receipt.CreatedBy,
                CreatedByDisplayName = createdByDisplayName,
                PreparedByDisplayName = createdByDisplayName,
                receipt.LastModifiedOnUtc,
                receipt.LastModifiedBy,
                LastModifiedByDisplayName = lastModifiedByDisplayName,
                InvoiceLines = (invoice?.Lines ?? Enumerable.Empty<SalesInvoiceLine>())
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
            }
        });
    }

    [HttpPost("customer-receipts")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> CreateCustomerReceipt(
        [FromBody] CreateCustomerReceiptRequest request,
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

        if (request.CustomerId == Guid.Empty)
        {
            return BadRequest(new { Message = "Customer is required." });
        }

        if (request.SalesInvoiceId == Guid.Empty)
        {
            return BadRequest(new { Message = "Sales invoice is required." });
        }

        if (string.IsNullOrWhiteSpace(request.ReceiptNumber))
        {
            return BadRequest(new { Message = "Receipt number is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new { Message = "Receipt description is required." });
        }

        if (request.Amount <= 0m)
        {
            return BadRequest(new { Message = "Receipt amount must be greater than zero." });
        }

        var customer = await dbContext.Customers
            .FirstOrDefaultAsync(x => x.Id == request.CustomerId, cancellationToken);

        if (customer is null)
        {
            return NotFound(new { Message = "The selected customer was not found." });
        }

        var invoice = await dbContext.SalesInvoices
            .FirstOrDefaultAsync(x => x.Id == request.SalesInvoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new { Message = "The selected sales invoice was not found." });
        }

        if (invoice.CustomerId != request.CustomerId)
        {
            return BadRequest(new { Message = "The selected invoice does not belong to the selected customer." });
        }

        if (invoice.Status != SalesInvoiceStatus.Posted && invoice.Status != SalesInvoiceStatus.PartPaid)
        {
            return BadRequest(new { Message = "Only posted or part-paid invoices can receive customer payments." });
        }

        if (request.Amount > invoice.BalanceAmount)
        {
            return BadRequest(new { Message = "Receipt amount cannot exceed the outstanding invoice balance." });
        }

        var normalizedReceiptNumber = request.ReceiptNumber.Trim().ToUpperInvariant();

        var exists = await dbContext.CustomerReceipts
            .AnyAsync(x => x.ReceiptNumber == normalizedReceiptNumber, cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A customer receipt with the same number already exists." });
        }

        var receipt = new CustomerReceipt(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.CustomerId,
            request.SalesInvoiceId,
            request.ReceiptDateUtc,
            normalizedReceiptNumber,
            request.Description,
            request.Amount);

        receipt.SetAudit(currentUserService.UserId, currentUserService.UserId);

        dbContext.CustomerReceipts.Add(receipt);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Customer receipt created successfully.",
            Receipt = new
            {
                receipt.Id,
                receipt.ReceiptNumber,
                receipt.Description,
                receipt.ReceiptDateUtc,
                receipt.Amount,
                receipt.Status,
                receipt.PostingRequiresApproval
            }
        });
    }

    [HttpPost("customer-receipts/{customerReceiptId:guid}/submit")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> SubmitCustomerReceiptForApproval(
        Guid customerReceiptId,
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

        var receipt = await dbContext.CustomerReceipts
            .FirstOrDefaultAsync(x => x.Id == customerReceiptId, cancellationToken);

        if (receipt is null)
        {
            return NotFound(new
            {
                Message = "Customer receipt was not found for the current tenant.",
                CustomerReceiptId = customerReceiptId
            });
        }

        var submittedByUserId = EnsureAuthenticatedUserId(currentUserService);

        try
        {
            receipt.SubmitForApproval(submittedByUserId);
            receipt.SetAudit(receipt.CreatedBy, submittedByUserId);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new
            {
                Message = ex.Message,
                CustomerReceiptId = customerReceiptId,
                receipt.Status
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Customer receipt submitted for approval successfully.",
            Receipt = new
            {
                receipt.Id,
                receipt.ReceiptNumber,
                receipt.Status,
                receipt.SubmittedBy,
                receipt.SubmittedOnUtc,
                receipt.PostingRequiresApproval
            }
        });
    }

    [HttpPost("customer-receipts/{customerReceiptId:guid}/approve")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Approver")]
    public async Task<IActionResult> ApproveCustomerReceipt(
        Guid customerReceiptId,
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

        var receipt = await dbContext.CustomerReceipts
            .FirstOrDefaultAsync(x => x.Id == customerReceiptId, cancellationToken);

        if (receipt is null)
        {
            return NotFound(new
            {
                Message = "Customer receipt was not found for the current tenant.",
                CustomerReceiptId = customerReceiptId
            });
        }

        var approvedByUserId = EnsureAuthenticatedUserId(currentUserService);

        try
        {
            receipt.Approve(approvedByUserId);
            receipt.SetAudit(receipt.CreatedBy, approvedByUserId);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new
            {
                Message = ex.Message,
                CustomerReceiptId = customerReceiptId,
                receipt.Status
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Customer receipt approved successfully.",
            Receipt = new
            {
                receipt.Id,
                receipt.ReceiptNumber,
                receipt.Status,
                receipt.ApprovedBy,
                receipt.ApprovedOnUtc
            }
        });
    }

    [HttpPost("customer-receipts/{customerReceiptId:guid}/reject")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Approver")]
    public async Task<IActionResult> RejectCustomerReceipt(
        Guid customerReceiptId,
        [FromBody] RejectCustomerReceiptRequest request,
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

        var receipt = await dbContext.CustomerReceipts
            .FirstOrDefaultAsync(x => x.Id == customerReceiptId, cancellationToken);

        if (receipt is null)
        {
            return NotFound(new
            {
                Message = "Customer receipt was not found for the current tenant.",
                CustomerReceiptId = customerReceiptId
            });
        }

        var rejectedByUserId = EnsureAuthenticatedUserId(currentUserService);

        try
        {
            receipt.Reject(rejectedByUserId, request.Reason);
            receipt.SetAudit(receipt.CreatedBy, rejectedByUserId);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new
            {
                Message = ex.Message,
                CustomerReceiptId = customerReceiptId,
                receipt.Status
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Customer receipt rejected successfully.",
            Receipt = new
            {
                receipt.Id,
                receipt.ReceiptNumber,
                receipt.Status,
                receipt.RejectedBy,
                receipt.RejectedOnUtc,
                receipt.RejectionReason
            }
        });
    }

    [HttpPost("customer-receipts/{customerReceiptId:guid}/post")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Approver")]
    public async Task<IActionResult> PostCustomerReceipt(
        Guid customerReceiptId,
        [FromBody] PostCustomerReceiptRequest request,
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

        if (request.CashOrBankLedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Cash or bank ledger account is required." });
        }

        if (request.ReceivableLedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Receivable ledger account is required." });
        }

        var receipt = await dbContext.CustomerReceipts
            .Include(x => x.Customer)
            .Include(x => x.SalesInvoice)
            .FirstOrDefaultAsync(x => x.Id == customerReceiptId, cancellationToken);

        if (receipt is null)
        {
            return NotFound(new
            {
                Message = "Customer receipt was not found for the current tenant.",
                CustomerReceiptId = customerReceiptId
            });
        }

        var requiredPostingStatus = receipt.PostingRequiresApproval
            ? CustomerReceiptStatus.Approved
            : CustomerReceiptStatus.Draft;

        if (receipt.Status != requiredPostingStatus)
        {
            return Conflict(new
            {
                Message = receipt.PostingRequiresApproval
                    ? "Only approved customer receipts can be posted."
                    : "Only draft customer receipts can be posted.",
                CustomerReceiptId = customerReceiptId,
                receipt.Status
            });
        }

        if (receipt.Amount <= 0m)
        {
            return Conflict(new
            {
                Message = "Only receipts with a positive amount can be posted.",
                CustomerReceiptId = customerReceiptId,
                receipt.Amount
            });
        }

        var invoice = await dbContext.SalesInvoices
            .FirstOrDefaultAsync(x => x.Id == receipt.SalesInvoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new { Message = "The linked sales invoice was not found." });
        }

        if (invoice.Status != SalesInvoiceStatus.Posted && invoice.Status != SalesInvoiceStatus.PartPaid)
        {
            return Conflict(new { Message = "The linked sales invoice is not eligible for receipt posting." });
        }

        if (receipt.Amount > invoice.BalanceAmount)
        {
            return Conflict(new { Message = "Receipt amount cannot exceed the outstanding invoice balance." });
        }

        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(
            dbContext,
            receipt.ReceiptDateUtc,
            cancellationToken);

        if (postingPeriod is null)
        {
            return Conflict(new
            {
                Message = "No open fiscal period exists for the receipt posting date.",
                PostingDateUtc = receipt.ReceiptDateUtc
            });
        }

        var requestedLedgerAccountIds = new[]
        {
            request.CashOrBankLedgerAccountId,
            request.ReceivableLedgerAccountId
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
        var receivableAccount = ledgerAccounts[request.ReceivableLedgerAccountId];

        if (!IsPostingReady(cashOrBankAccount))
        {
            return BadRequest(new
            {
                Message = "The cash or bank ledger account must be active, non-header, and posting-enabled.",
                cashOrBankAccount.Id,
                cashOrBankAccount.Code
            });
        }

        if (!IsPostingReady(receivableAccount))
        {
            return BadRequest(new
            {
                Message = "The receivable ledger account must be active, non-header, and posting-enabled.",
                receivableAccount.Id,
                receivableAccount.Code
            });
        }

        var reference = $"RCV-{receipt.ReceiptNumber}";

        var referenceExists = await dbContext.JournalEntries
            .AsNoTracking()
            .AnyAsync(x => x.Reference == reference, cancellationToken);

        if (referenceExists)
        {
            return Conflict(new
            {
                Message = "A journal entry with the generated receipt posting reference already exists.",
                Reference = reference
            });
        }

        var customerName = receipt.Customer?.CustomerName ?? "Customer";
        var invoiceNumber = receipt.SalesInvoice?.InvoiceNumber ?? "Invoice";

        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            receipt.ReceiptDateUtc,
            reference,
            $"Customer receipt posting - {receipt.ReceiptNumber} - {customerName} - {invoiceNumber}",
            JournalEntryStatus.Draft,
            JournalEntryType.Normal,
            new[]
            {
                new JournalEntryLine(
                    Guid.NewGuid(),
                    cashOrBankAccount.Id,
                    $"Customer receipt - {receipt.ReceiptNumber}",
                    receipt.Amount,
                    0m),
                new JournalEntryLine(
                    Guid.NewGuid(),
                    receivableAccount.Id,
                    $"Accounts receivable settlement - {invoiceNumber}",
                    0m,
                    receipt.Amount)
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

        receipt.MarkPosted(journalEntry.Id);
        receipt.SetAudit(receipt.CreatedBy, currentUserService.UserId);
        invoice.ApplyPayment(receipt.Amount);

        dbContext.JournalEntries.Add(journalEntry);
        dbContext.LedgerMovements.AddRange(movements);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Customer receipt posted successfully.",
            Receipt = new
            {
                receipt.Id,
                receipt.ReceiptNumber,
                receipt.Status,
                receipt.Amount,
                receipt.JournalEntryId,
                receipt.PostedOnUtc
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

    public sealed record CreateCustomerRequest(
        string CustomerCode,
        string CustomerName,
        string? Email,
        string? PhoneNumber,
        string? BillingAddress,
        bool IsActive);

    public sealed record CreateSalesInvoiceLineRequest(
        string Description,
        decimal Quantity,
        decimal UnitPrice);

    public sealed record CreateSalesInvoiceRequest(
        Guid CustomerId,
        DateTime InvoiceDateUtc,
        string InvoiceNumber,
        string Description,
        List<CreateSalesInvoiceLineRequest> Lines);

    public sealed record PostSalesInvoiceRequest(
        Guid ReceivableLedgerAccountId,
        Guid RevenueLedgerAccountId);

    public sealed record CreateCustomerReceiptRequest(
        Guid CustomerId,
        Guid SalesInvoiceId,
        DateTime ReceiptDateUtc,
        string ReceiptNumber,
        string Description,
        decimal Amount);

    public sealed record PostCustomerReceiptRequest(
        Guid CashOrBankLedgerAccountId,
        Guid ReceivableLedgerAccountId);

    public sealed record RejectCustomerReceiptRequest(
        string Reason);
}