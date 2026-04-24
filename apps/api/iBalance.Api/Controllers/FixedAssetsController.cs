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
[Route("api/finance/fixed-assets")]
public sealed class FixedAssetsController : ControllerBase
{
    [HttpGet("classes")]
    public async Task<IActionResult> GetFixedAssetClasses(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<FixedAssetClass>()
            .AsNoTracking()
            .OrderBy(x => x.Code)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.Code,
                x.Name,
                x.Description,
                x.CapitalizationThreshold,
                x.ResidualValuePercentDefault,
                x.UsefulLifeMonthsDefault,
                x.DepreciationMethodDefault,
                x.AssetCostLedgerAccountId,
                x.AccumulatedDepreciationLedgerAccountId,
                x.DepreciationExpenseLedgerAccountId,
                x.DisposalGainLossLedgerAccountId,
                x.Status
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

    [HttpPost("classes")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> CreateFixedAssetClass(
        [FromBody] CreateFixedAssetClassRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var normalizedCode = request.Code?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalizedCode)) return BadRequest(new { Message = "Fixed asset class code is required." });
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { Message = "Fixed asset class name is required." });

        var exists = await dbContext.Set<FixedAssetClass>().AsNoTracking().AnyAsync(x => x.Code == normalizedCode, cancellationToken);
        if (exists)
        {
            return Conflict(new { Message = "A fixed asset class with the same code already exists.", Code = normalizedCode });
        }

        var validation = await ValidateLedgerAccountsAsync(
            dbContext,
            new[]
            {
                request.AssetCostLedgerAccountId,
                request.AccumulatedDepreciationLedgerAccountId,
                request.DepreciationExpenseLedgerAccountId,
                request.DisposalGainLossLedgerAccountId
            },
            cancellationToken);

        if (validation is not null) return validation;

        try
        {
            var assetClass = new FixedAssetClass(
                Guid.NewGuid(),
                tenantContext.TenantId,
                normalizedCode,
                request.Name.Trim(),
                request.Description,
                request.CapitalizationThreshold,
                request.ResidualValuePercentDefault,
                request.UsefulLifeMonthsDefault,
                request.DepreciationMethodDefault,
                request.AssetCostLedgerAccountId,
                request.AccumulatedDepreciationLedgerAccountId,
                request.DepreciationExpenseLedgerAccountId,
                request.DisposalGainLossLedgerAccountId);

            dbContext.Add(assetClass);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new { Message = "Fixed asset class created successfully.", AssetClass = assetClass });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetFixedAssets(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<FixedAsset>()
            .AsNoTracking()
            .OrderByDescending(x => x.AcquisitionDateUtc)
            .ThenBy(x => x.AssetNumber)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.FixedAssetClassId,
                x.AssetNumber,
                x.AssetName,
                x.Description,
                x.AcquisitionDateUtc,
                x.CapitalizationDateUtc,
                x.AcquisitionCost,
                x.ResidualValue,
                x.UsefulLifeMonths,
                x.DepreciationMethod,
                x.AccumulatedDepreciationAmount,
                x.ImpairmentAmount,
                NetBookValue = x.AcquisitionCost - x.AccumulatedDepreciationAmount - x.ImpairmentAmount,
                x.Status,
                x.AssetCostLedgerAccountId,
                x.AccumulatedDepreciationLedgerAccountId,
                x.DepreciationExpenseLedgerAccountId,
                x.DisposalGainLossLedgerAccountId,
                x.VendorId,
                x.PurchaseInvoiceId,
                x.Location,
                x.Custodian,
                x.SerialNumber,
                x.Notes,
                x.LastDepreciationPostedOnUtc,
                x.DisposedOnUtc,
                x.DisposalProceedsAmount
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

    [HttpGet("reports/register")]
    public async Task<IActionResult> GetFixedAssetRegister(
        [FromQuery] FixedAssetStatus? status,
        [FromQuery] Guid? fixedAssetClassId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var classes = await dbContext.Set<FixedAssetClass>()
            .AsNoTracking()
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        IQueryable<FixedAsset> query = dbContext.Set<FixedAsset>().AsNoTracking();

        if (status.HasValue)
        {
            query = query.Where(x => x.Status == status.Value);
        }

        if (fixedAssetClassId.HasValue)
        {
            query = query.Where(x => x.FixedAssetClassId == fixedAssetClassId.Value);
        }

        var items = await query
            .OrderBy(x => x.AssetNumber)
            .Select(x => new
            {
                x.Id,
                x.AssetNumber,
                x.AssetName,
                x.FixedAssetClassId,
                x.AcquisitionDateUtc,
                x.CapitalizationDateUtc,
                x.AcquisitionCost,
                x.ResidualValue,
                x.AccumulatedDepreciationAmount,
                x.ImpairmentAmount,
                x.Status,
                x.Location,
                x.Custodian,
                x.SerialNumber,
                x.LastDepreciationPostedOnUtc,
                x.DisposedOnUtc,
                x.DisposalProceedsAmount,
                NetBookValue = x.AcquisitionCost - x.AccumulatedDepreciationAmount - x.ImpairmentAmount
            })
            .ToListAsync(cancellationToken);

        var shapedItems = items.Select(x => new
        {
            x.Id,
            x.AssetNumber,
            x.AssetName,
            x.FixedAssetClassId,
            FixedAssetClassCode = classes.TryGetValue(x.FixedAssetClassId, out var assetClass) ? assetClass.Code : null,
            FixedAssetClassName = classes.TryGetValue(x.FixedAssetClassId, out assetClass) ? assetClass.Name : null,
            x.AcquisitionDateUtc,
            x.CapitalizationDateUtc,
            x.AcquisitionCost,
            x.ResidualValue,
            x.AccumulatedDepreciationAmount,
            x.ImpairmentAmount,
            x.NetBookValue,
            x.Status,
            x.Location,
            x.Custodian,
            x.SerialNumber,
            x.LastDepreciationPostedOnUtc,
            x.DisposedOnUtc,
            x.DisposalProceedsAmount
        }).ToList();

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = shapedItems.Count,
            TotalAcquisitionCost = shapedItems.Sum(x => x.AcquisitionCost),
            TotalAccumulatedDepreciation = shapedItems.Sum(x => x.AccumulatedDepreciationAmount),
            TotalImpairment = shapedItems.Sum(x => x.ImpairmentAmount),
            TotalNetBookValue = shapedItems.Sum(x => x.NetBookValue),
            Items = shapedItems
        });
    }

    [HttpPost("capitalize-from-purchase-invoice")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> CapitalizeFromPurchaseInvoice(
        [FromBody] CapitalizePurchaseInvoiceToFixedAssetRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (request.PurchaseInvoiceId == Guid.Empty) return BadRequest(new { Message = "Purchase invoice is required." });
        if (request.FixedAssetClassId == Guid.Empty) return BadRequest(new { Message = "Fixed asset class is required." });
        if (string.IsNullOrWhiteSpace(request.AssetNumber)) return BadRequest(new { Message = "Asset number is required." });
        if (string.IsNullOrWhiteSpace(request.AssetName)) return BadRequest(new { Message = "Asset name is required." });

        var invoice = await dbContext.PurchaseInvoices
            .Include(x => x.Vendor)
            .FirstOrDefaultAsync(x => x.Id == request.PurchaseInvoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new { Message = "Purchase invoice was not found for the current tenant.", request.PurchaseInvoiceId });
        }

        if (!invoice.JournalEntryId.HasValue || !invoice.PostedOnUtc.HasValue)
        {
            return Conflict(new { Message = "Only posted purchase invoices can be capitalized into fixed assets.", request.PurchaseInvoiceId, invoice.Status });
        }

        if (invoice.TotalAmount <= 0m)
        {
            return Conflict(new { Message = "Only purchase invoices with a positive base amount can be capitalized.", request.PurchaseInvoiceId });
        }

        var alreadyCapitalized = await dbContext.Set<FixedAsset>()
            .AsNoTracking()
            .AnyAsync(x => x.PurchaseInvoiceId == invoice.Id, cancellationToken);

        if (alreadyCapitalized)
        {
            return Conflict(new { Message = "This purchase invoice has already been capitalized into a fixed asset.", request.PurchaseInvoiceId });
        }

        var assetClass = await dbContext.Set<FixedAssetClass>()
            .FirstOrDefaultAsync(x => x.Id == request.FixedAssetClassId, cancellationToken);

        if (assetClass is null) return NotFound(new { Message = "Fixed asset class was not found.", request.FixedAssetClassId });
        if (assetClass.Status != FixedAssetClassStatus.Active) return Conflict(new { Message = "Only active fixed asset classes can be used.", request.FixedAssetClassId });

        var assetNumber = request.AssetNumber.Trim().ToUpperInvariant();
        var assetNumberExists = await dbContext.Set<FixedAsset>()
            .AsNoTracking()
            .AnyAsync(x => x.AssetNumber == assetNumber, cancellationToken);

        if (assetNumberExists)
        {
            return Conflict(new { Message = "A fixed asset with the same asset number already exists.", AssetNumber = assetNumber });
        }

        var capitalizationDateUtc = request.CapitalizationDateUtc ?? invoice.PostedOnUtc.Value;
        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(dbContext, capitalizationDateUtc, cancellationToken);
        if (postingPeriod is null) return Conflict(new { Message = "No open fiscal period exists for the fixed asset capitalization date.", CapitalizationDateUtc = capitalizationDateUtc });

        var assetCostLedgerAccountId = request.AssetCostLedgerAccountId == Guid.Empty ? assetClass.AssetCostLedgerAccountId : request.AssetCostLedgerAccountId;
        var accumulatedDepreciationLedgerAccountId = request.AccumulatedDepreciationLedgerAccountId == Guid.Empty ? assetClass.AccumulatedDepreciationLedgerAccountId : request.AccumulatedDepreciationLedgerAccountId;
        var depreciationExpenseLedgerAccountId = request.DepreciationExpenseLedgerAccountId == Guid.Empty ? assetClass.DepreciationExpenseLedgerAccountId : request.DepreciationExpenseLedgerAccountId;
        var disposalGainLossLedgerAccountId = request.DisposalGainLossLedgerAccountId == Guid.Empty ? assetClass.DisposalGainLossLedgerAccountId : request.DisposalGainLossLedgerAccountId;

        var validation = await ValidateLedgerAccountsAsync(
            dbContext,
            new[] { assetCostLedgerAccountId, accumulatedDepreciationLedgerAccountId, depreciationExpenseLedgerAccountId, disposalGainLossLedgerAccountId },
            cancellationToken);
        if (validation is not null) return validation;

        var acquisitionCost = invoice.TotalAmount;
        var usefulLifeMonths = request.UsefulLifeMonths <= 0 ? assetClass.UsefulLifeMonthsDefault : request.UsefulLifeMonths;
        var depreciationMethod = request.DepreciationMethod == FixedAssetDepreciationMethod.None ? assetClass.DepreciationMethodDefault : request.DepreciationMethod;
        var notes = string.IsNullOrWhiteSpace(request.Notes)
            ? $"Capitalized from AP purchase invoice {invoice.InvoiceNumber}. No additional GL journal was posted by this fixed asset capitalization action because the AP invoice is already posted."
            : request.Notes.Trim();

        try
        {
            var fixedAsset = new FixedAsset(
                Guid.NewGuid(),
                tenantContext.TenantId,
                request.FixedAssetClassId,
                assetNumber,
                request.AssetName.Trim(),
                request.Description,
                invoice.InvoiceDateUtc,
                acquisitionCost,
                request.ResidualValue,
                usefulLifeMonths,
                depreciationMethod,
                assetCostLedgerAccountId,
                accumulatedDepreciationLedgerAccountId,
                depreciationExpenseLedgerAccountId,
                disposalGainLossLedgerAccountId,
                invoice.VendorId,
                invoice.Id,
                request.Location,
                request.Custodian,
                request.SerialNumber,
                notes);

            fixedAsset.Capitalize(capitalizationDateUtc);

            dbContext.Add(fixedAsset);
            dbContext.Add(new FixedAssetTransaction(
                Guid.NewGuid(),
                tenantContext.TenantId,
                fixedAsset.Id,
                FixedAssetTransactionType.Acquisition,
                invoice.InvoiceDateUtc,
                acquisitionCost,
                $"Acquisition from AP purchase invoice {invoice.InvoiceNumber}",
                invoice.JournalEntryId,
                invoice.InvoiceNumber,
                notes));

            dbContext.Add(new FixedAssetTransaction(
                Guid.NewGuid(),
                tenantContext.TenantId,
                fixedAsset.Id,
                FixedAssetTransactionType.Capitalization,
                capitalizationDateUtc,
                acquisitionCost,
                $"Capitalization from AP purchase invoice {invoice.InvoiceNumber}",
                invoice.JournalEntryId,
                $"FA-AP-{invoice.InvoiceNumber}",
                notes));

            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Purchase invoice capitalized into fixed asset successfully.",
                FixedAsset = fixedAsset,
                PurchaseInvoiceId = invoice.Id,
                invoice.InvoiceNumber,
                VendorId = invoice.VendorId,
                VendorName = invoice.Vendor != null ? invoice.Vendor.VendorName : null,
                FiscalPeriodId = postingPeriod.Id,
                FiscalPeriodName = postingPeriod.Name,
                GlPostingSkipped = true,
                GlPostingReason = "The AP purchase invoice is already posted; fixed asset capitalization did not create a duplicate GL journal."
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { Message = ex.Message, request.PurchaseInvoiceId });
        }
    }


    [HttpPost]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> CreateFixedAsset(
        [FromBody] CreateFixedAssetRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.AssetNumber)) return BadRequest(new { Message = "Asset number is required." });
        if (string.IsNullOrWhiteSpace(request.AssetName)) return BadRequest(new { Message = "Asset name is required." });

        var assetClass = await dbContext.Set<FixedAssetClass>().FirstOrDefaultAsync(x => x.Id == request.FixedAssetClassId, cancellationToken);
        if (assetClass is null) return NotFound(new { Message = "Fixed asset class was not found.", request.FixedAssetClassId });
        if (assetClass.Status != FixedAssetClassStatus.Active) return Conflict(new { Message = "Only active fixed asset classes can be used.", request.FixedAssetClassId });

        var assetNumber = request.AssetNumber.Trim().ToUpperInvariant();
        var exists = await dbContext.Set<FixedAsset>().AsNoTracking().AnyAsync(x => x.AssetNumber == assetNumber, cancellationToken);
        if (exists) return Conflict(new { Message = "A fixed asset with the same asset number already exists.", AssetNumber = assetNumber });

        var assetCostLedgerAccountId = request.AssetCostLedgerAccountId == Guid.Empty ? assetClass.AssetCostLedgerAccountId : request.AssetCostLedgerAccountId;
        var accumulatedDepreciationLedgerAccountId = request.AccumulatedDepreciationLedgerAccountId == Guid.Empty ? assetClass.AccumulatedDepreciationLedgerAccountId : request.AccumulatedDepreciationLedgerAccountId;
        var depreciationExpenseLedgerAccountId = request.DepreciationExpenseLedgerAccountId == Guid.Empty ? assetClass.DepreciationExpenseLedgerAccountId : request.DepreciationExpenseLedgerAccountId;
        var disposalGainLossLedgerAccountId = request.DisposalGainLossLedgerAccountId == Guid.Empty ? assetClass.DisposalGainLossLedgerAccountId : request.DisposalGainLossLedgerAccountId;

        var validation = await ValidateLedgerAccountsAsync(
            dbContext,
            new[] { assetCostLedgerAccountId, accumulatedDepreciationLedgerAccountId, depreciationExpenseLedgerAccountId, disposalGainLossLedgerAccountId },
            cancellationToken);
        if (validation is not null) return validation;

        try
        {
            var fixedAsset = new FixedAsset(
                Guid.NewGuid(),
                tenantContext.TenantId,
                request.FixedAssetClassId,
                assetNumber,
                request.AssetName.Trim(),
                request.Description,
                request.AcquisitionDateUtc,
                request.AcquisitionCost,
                request.ResidualValue,
                request.UsefulLifeMonths <= 0 ? assetClass.UsefulLifeMonthsDefault : request.UsefulLifeMonths,
                request.DepreciationMethod == FixedAssetDepreciationMethod.None ? assetClass.DepreciationMethodDefault : request.DepreciationMethod,
                assetCostLedgerAccountId,
                accumulatedDepreciationLedgerAccountId,
                depreciationExpenseLedgerAccountId,
                disposalGainLossLedgerAccountId,
                request.VendorId,
                request.PurchaseInvoiceId,
                request.Location,
                request.Custodian,
                request.SerialNumber,
                request.Notes);

            dbContext.Add(fixedAsset);
            dbContext.Add(new FixedAssetTransaction(
                Guid.NewGuid(),
                tenantContext.TenantId,
                fixedAsset.Id,
                FixedAssetTransactionType.Acquisition,
                request.AcquisitionDateUtc,
                request.AcquisitionCost,
                $"Acquisition of fixed asset {fixedAsset.AssetNumber}",
                reference: fixedAsset.AssetNumber,
                notes: request.Notes));

            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(new { Message = "Fixed asset created successfully.", FixedAsset = fixedAsset });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("{fixedAssetId:guid}")]
    public async Task<IActionResult> GetFixedAssetDetail(
        Guid fixedAssetId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var asset = await dbContext.Set<FixedAsset>().AsNoTracking().FirstOrDefaultAsync(x => x.Id == fixedAssetId, cancellationToken);
        if (asset is null) return NotFound(new { Message = "Fixed asset was not found.", FixedAssetId = fixedAssetId });

        var transactions = await dbContext.Set<FixedAssetTransaction>()
            .AsNoTracking()
            .Where(x => x.FixedAssetId == fixedAssetId)
            .OrderBy(x => x.TransactionDateUtc)
            .ThenBy(x => x.TransactionType)
            .ToListAsync(cancellationToken);

        var depreciationLines = await dbContext.Set<FixedAssetDepreciationLine>()
            .AsNoTracking()
            .Where(x => x.FixedAssetId == fixedAssetId)
            .OrderBy(x => x.DepreciationPeriodStartUtc)
            .ToListAsync(cancellationToken);

        var disposal = await dbContext.Set<FixedAssetDisposal>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.FixedAssetId == fixedAssetId, cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            FixedAsset = asset,
            Transactions = transactions,
            DepreciationLines = depreciationLines,
            Disposal = disposal
        });
    }

    [HttpPost("{fixedAssetId:guid}/capitalize")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> CapitalizeFixedAsset(
        Guid fixedAssetId,
        [FromBody] CapitalizeFixedAssetRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (request.CreditLedgerAccountId == Guid.Empty) return BadRequest(new { Message = "Credit ledger account is required." });

        var asset = await dbContext.Set<FixedAsset>().FirstOrDefaultAsync(x => x.Id == fixedAssetId, cancellationToken);
        if (asset is null) return NotFound(new { Message = "Fixed asset was not found.", FixedAssetId = fixedAssetId });

        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(dbContext, request.CapitalizationDateUtc, cancellationToken);
        if (postingPeriod is null) return Conflict(new { Message = "No open fiscal period exists for the fixed asset capitalization date.", request.CapitalizationDateUtc });

        var validation = await ValidateLedgerAccountsAsync(dbContext, new[] { asset.AssetCostLedgerAccountId, request.CreditLedgerAccountId }, cancellationToken);
        if (validation is not null) return validation;

        var reference = string.IsNullOrWhiteSpace(request.Reference) ? $"FA-CAP-{asset.AssetNumber}" : request.Reference.Trim().ToUpperInvariant();
        var referenceExists = await dbContext.JournalEntries.AsNoTracking().AnyAsync(x => x.Reference == reference, cancellationToken);
        if (referenceExists) return Conflict(new { Message = "A journal entry with the same capitalization reference already exists.", Reference = reference });

        try
        {
            asset.Capitalize(request.CapitalizationDateUtc);

            var lines = new List<JournalEntryLine>
            {
                new(Guid.NewGuid(), asset.AssetCostLedgerAccountId, $"Fixed asset capitalization - {asset.AssetNumber}", asset.AcquisitionCost, 0m),
                new(Guid.NewGuid(), request.CreditLedgerAccountId, $"Fixed asset capitalization funding - {asset.AssetNumber}", 0m, asset.AcquisitionCost)
            };

            var journalEntry = new JournalEntry(
                Guid.NewGuid(),
                tenantContext.TenantId,
                request.CapitalizationDateUtc,
                reference,
                request.Description?.Trim() ?? $"Fixed asset capitalization - {asset.AssetNumber} - {asset.AssetName}",
                JournalEntryStatus.Draft,
                JournalEntryType.Normal,
                lines,
                postingRequiresApproval: false);

            journalEntry.MarkPosted(DateTime.UtcNow);

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

            dbContext.Add(journalEntry);
            dbContext.LedgerMovements.AddRange(movements);
            dbContext.Add(new FixedAssetTransaction(
                Guid.NewGuid(),
                tenantContext.TenantId,
                asset.Id,
                FixedAssetTransactionType.Capitalization,
                request.CapitalizationDateUtc,
                asset.AcquisitionCost,
                $"Capitalization of fixed asset {asset.AssetNumber}",
                journalEntry.Id,
                reference,
                request.Description));

            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(new { Message = "Fixed asset capitalized successfully.", FixedAsset = asset, JournalEntryId = journalEntry.Id, FiscalPeriodId = postingPeriod.Id, FiscalPeriodName = postingPeriod.Name });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { Message = ex.Message, FixedAssetId = fixedAssetId });
        }
    }

    [HttpPost("depreciation/preview")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant,Approver")]
    public async Task<IActionResult> PreviewDepreciation(
        [FromBody] FixedAssetDepreciationPeriodRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var validationError = ValidateDepreciationPeriod(request.PeriodStartUtc, request.PeriodEndUtc);
        if (validationError is not null) return BadRequest(new { Message = validationError });

        var assets = await GetDepreciationCandidateAssetsAsync(dbContext, request.PeriodEndUtc, cancellationToken);
        var existingLines = await dbContext.Set<FixedAssetDepreciationLine>()
            .AsNoTracking()
            .Where(x => x.DepreciationPeriodStartUtc == request.PeriodStartUtc && x.DepreciationPeriodEndUtc == request.PeriodEndUtc)
            .Select(x => x.FixedAssetId)
            .ToListAsync(cancellationToken);

        var existingLineSet = existingLines.ToHashSet();

        var items = assets
            .Select(asset => BuildDepreciationPreviewItem(asset, request.PeriodStartUtc, request.PeriodEndUtc, existingLineSet.Contains(asset.Id)))
            .Where(x => x is not null)
            .Select(x => x!)
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            request.PeriodStartUtc,
            request.PeriodEndUtc,
            Count = items.Count,
            TotalDepreciationAmount = items.Sum(x => x.DepreciationAmount),
            Items = items
        });
    }

    [HttpGet("depreciation-runs")]
    public async Task<IActionResult> GetDepreciationRuns(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<FixedAssetDepreciationRun>()
            .AsNoTracking()
            .OrderByDescending(x => x.PeriodEndUtc)
            .ThenByDescending(x => x.RunDateUtc)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.PeriodStartUtc,
                x.PeriodEndUtc,
                x.RunDateUtc,
                x.Description,
                x.JournalEntryId,
                LineCount = dbContext.Set<FixedAssetDepreciationLine>().Count(line => line.DepreciationRunId == x.Id),
                TotalDepreciationAmount = dbContext.Set<FixedAssetDepreciationLine>().Where(line => line.DepreciationRunId == x.Id).Sum(line => (decimal?)line.DepreciationAmount) ?? 0m
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

    [HttpPost("depreciation-runs")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> RunDepreciation(
        [FromBody] RunFixedAssetDepreciationRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var validationError = ValidateDepreciationPeriod(request.PeriodStartUtc, request.PeriodEndUtc);
        if (validationError is not null) return BadRequest(new { Message = validationError });

        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(dbContext, request.RunDateUtc, cancellationToken);
        if (postingPeriod is null)
        {
            return Conflict(new { Message = "No open fiscal period exists for the depreciation run date.", request.RunDateUtc });
        }

        var existingRun = await dbContext.Set<FixedAssetDepreciationRun>()
            .AsNoTracking()
            .AnyAsync(x => x.PeriodStartUtc == request.PeriodStartUtc && x.PeriodEndUtc == request.PeriodEndUtc, cancellationToken);
        if (existingRun)
        {
            return Conflict(new { Message = "A depreciation run already exists for the selected period.", request.PeriodStartUtc, request.PeriodEndUtc });
        }

        var assets = await GetDepreciationCandidateAssetsAsync(dbContext, request.PeriodEndUtc, cancellationToken);
        var alreadyDepreciatedAssetIds = await dbContext.Set<FixedAssetDepreciationLine>()
            .AsNoTracking()
            .Where(x => x.DepreciationPeriodStartUtc == request.PeriodStartUtc && x.DepreciationPeriodEndUtc == request.PeriodEndUtc)
            .Select(x => x.FixedAssetId)
            .ToListAsync(cancellationToken);

        var existingLineSet = alreadyDepreciatedAssetIds.ToHashSet();
        var previewItems = assets
            .Select(asset => BuildDepreciationPreviewItem(asset, request.PeriodStartUtc, request.PeriodEndUtc, existingLineSet.Contains(asset.Id)))
            .Where(x => x is not null && x.DepreciationAmount > 0m)
            .Select(x => x!)
            .ToList();

        if (previewItems.Count == 0)
        {
            return Conflict(new { Message = "No eligible fixed assets were found for depreciation in the selected period." });
        }

        var ledgerIds = previewItems
            .SelectMany(x => new[] { x.DepreciationExpenseLedgerAccountId, x.AccumulatedDepreciationLedgerAccountId })
            .Distinct()
            .ToList();

        var ledgerValidation = await ValidateLedgerAccountsAsync(dbContext, ledgerIds, cancellationToken);
        if (ledgerValidation is not null) return ledgerValidation;

        var runReference = string.IsNullOrWhiteSpace(request.Reference)
            ? $"FA-DEP-{request.PeriodEndUtc:yyyyMMdd}"
            : request.Reference.Trim().ToUpperInvariant();

        var referenceExists = await dbContext.JournalEntries.AsNoTracking().AnyAsync(x => x.Reference == runReference, cancellationToken);
        if (referenceExists)
        {
            return Conflict(new { Message = "A journal entry with the same depreciation run reference already exists.", Reference = runReference });
        }

        var run = new FixedAssetDepreciationRun(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.PeriodStartUtc,
            request.PeriodEndUtc,
            request.RunDateUtc,
            string.IsNullOrWhiteSpace(request.Description)
                ? $"Fixed asset depreciation run for {request.PeriodStartUtc:yyyy-MM-dd} to {request.PeriodEndUtc:yyyy-MM-dd}"
                : request.Description.Trim());

        var depreciationLines = new List<FixedAssetDepreciationLine>();
        var transactions = new List<FixedAssetTransaction>();
        var journalLines = new List<JournalEntryLine>();
        var nowUtc = DateTime.UtcNow;

        foreach (var item in previewItems)
        {
            var asset = assets.First(x => x.Id == item.FixedAssetId);

            journalLines.Add(new JournalEntryLine(
                Guid.NewGuid(),
                asset.DepreciationExpenseLedgerAccountId,
                $"Depreciation expense - {asset.AssetNumber}",
                item.DepreciationAmount,
                0m));

            journalLines.Add(new JournalEntryLine(
                Guid.NewGuid(),
                asset.AccumulatedDepreciationLedgerAccountId,
                $"Accumulated depreciation - {asset.AssetNumber}",
                0m,
                item.DepreciationAmount));

            asset.RecordDepreciation(item.DepreciationAmount, request.RunDateUtc);

            depreciationLines.Add(new FixedAssetDepreciationLine(
                Guid.NewGuid(),
                tenantContext.TenantId,
                run.Id,
                asset.Id,
                request.PeriodStartUtc,
                request.PeriodEndUtc,
                item.DepreciationAmount,
                item.OpeningNetBookValue,
                item.ClosingNetBookValue));

            transactions.Add(new FixedAssetTransaction(
                Guid.NewGuid(),
                tenantContext.TenantId,
                asset.Id,
                FixedAssetTransactionType.Depreciation,
                request.RunDateUtc,
                item.DepreciationAmount,
                $"Depreciation posted for {asset.AssetNumber} for period {request.PeriodStartUtc:yyyy-MM-dd} to {request.PeriodEndUtc:yyyy-MM-dd}",
                reference: runReference,
                notes: request.Description));
        }

        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.RunDateUtc,
            runReference,
            run.Description,
            JournalEntryStatus.Draft,
            JournalEntryType.Normal,
            journalLines,
            postingRequiresApproval: false);

        journalEntry.MarkPosted(nowUtc);
        run.LinkJournal(journalEntry.Id);

        for (var i = 0; i < transactions.Count; i++)
        {
            transactions[i] = new FixedAssetTransaction(
                transactions[i].Id,
                transactions[i].TenantId,
                transactions[i].FixedAssetId,
                transactions[i].TransactionType,
                transactions[i].TransactionDateUtc,
                transactions[i].Amount,
                transactions[i].Description,
                journalEntry.Id,
                transactions[i].Reference,
                transactions[i].Notes);
        }

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

        dbContext.Add(run);
        dbContext.Add(journalEntry);
        dbContext.AddRange(depreciationLines);
        dbContext.AddRange(transactions);
        dbContext.LedgerMovements.AddRange(movements);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Fixed asset depreciation run posted successfully.",
            DepreciationRun = new
            {
                run.Id,
                run.PeriodStartUtc,
                run.PeriodEndUtc,
                run.RunDateUtc,
                run.Description,
                run.JournalEntryId,
                LineCount = depreciationLines.Count,
                TotalDepreciationAmount = depreciationLines.Sum(x => x.DepreciationAmount)
            },
            FiscalPeriodId = postingPeriod.Id,
            FiscalPeriodName = postingPeriod.Name,
            JournalEntry = new
            {
                journalEntry.Id,
                journalEntry.Reference,
                journalEntry.Description,
                journalEntry.PostedAtUtc,
                journalEntry.TotalDebit,
                journalEntry.TotalCredit
            }
        });
    }

    [HttpPost("{fixedAssetId:guid}/improvements")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> RecordImprovement(
        Guid fixedAssetId,
        [FromBody] FixedAssetImprovementRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (request.CreditLedgerAccountId == Guid.Empty) return BadRequest(new { Message = "Credit ledger account is required." });
        if (request.Amount <= 0m) return BadRequest(new { Message = "Improvement amount must be greater than zero." });

        var asset = await dbContext.Set<FixedAsset>().FirstOrDefaultAsync(x => x.Id == fixedAssetId, cancellationToken);
        if (asset is null) return NotFound(new { Message = "Fixed asset was not found.", FixedAssetId = fixedAssetId });
        if (asset.Status == FixedAssetStatus.Draft) return Conflict(new { Message = "Draft fixed assets must be capitalized before improvement can be recorded.", FixedAssetId = fixedAssetId });

        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(dbContext, request.TransactionDateUtc, cancellationToken);
        if (postingPeriod is null) return Conflict(new { Message = "No open fiscal period exists for the fixed asset improvement date.", request.TransactionDateUtc });

        var validation = await ValidateLedgerAccountsAsync(dbContext, new[] { asset.AssetCostLedgerAccountId, request.CreditLedgerAccountId }, cancellationToken);
        if (validation is not null) return validation;

        var reference = string.IsNullOrWhiteSpace(request.Reference) ? $"FA-IMP-{asset.AssetNumber}-{request.TransactionDateUtc:yyyyMMdd}" : request.Reference.Trim().ToUpperInvariant();
        var referenceExists = await dbContext.JournalEntries.AsNoTracking().AnyAsync(x => x.Reference == reference, cancellationToken);
        if (referenceExists) return Conflict(new { Message = "A journal entry with the same improvement reference already exists.", Reference = reference });

        asset.RecordImprovement(request.Amount, request.UsefulLifeMonthsOverride);

        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.TransactionDateUtc,
            reference,
            string.IsNullOrWhiteSpace(request.Description) ? $"Fixed asset improvement - {asset.AssetNumber}" : request.Description.Trim(),
            JournalEntryStatus.Draft,
            JournalEntryType.Normal,
            new[]
            {
                new JournalEntryLine(Guid.NewGuid(), asset.AssetCostLedgerAccountId, $"Fixed asset improvement - {asset.AssetNumber}", request.Amount, 0m),
                new JournalEntryLine(Guid.NewGuid(), request.CreditLedgerAccountId, $"Improvement funding - {asset.AssetNumber}", 0m, request.Amount)
            },
            postingRequiresApproval: false);

        journalEntry.MarkPosted(DateTime.UtcNow);

        var movements = journalEntry.Lines.Select(line => new LedgerMovement(
            Guid.NewGuid(),
            tenantContext.TenantId,
            journalEntry.Id,
            line.Id,
            line.LedgerAccountId,
            journalEntry.EntryDateUtc,
            journalEntry.Reference,
            line.Description,
            line.DebitAmount,
            line.CreditAmount)).ToList();

        dbContext.Add(journalEntry);
        dbContext.LedgerMovements.AddRange(movements);
        dbContext.Add(new FixedAssetTransaction(
            Guid.NewGuid(),
            tenantContext.TenantId,
            asset.Id,
            FixedAssetTransactionType.Improvement,
            request.TransactionDateUtc,
            request.Amount,
            $"Improvement recorded for fixed asset {asset.AssetNumber}",
            journalEntry.Id,
            reference,
            request.Description));

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Fixed asset improvement recorded successfully.",
            FixedAsset = asset,
            JournalEntryId = journalEntry.Id,
            FiscalPeriodId = postingPeriod.Id,
            FiscalPeriodName = postingPeriod.Name
        });
    }

    [HttpPost("{fixedAssetId:guid}/transfer")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> TransferFixedAsset(
        Guid fixedAssetId,
        [FromBody] TransferFixedAssetRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var asset = await dbContext.Set<FixedAsset>().FirstOrDefaultAsync(x => x.Id == fixedAssetId, cancellationToken);
        if (asset is null) return NotFound(new { Message = "Fixed asset was not found.", FixedAssetId = fixedAssetId });

        try
        {
            asset.Transfer(request.Location, request.Custodian);
            dbContext.Add(new FixedAssetTransaction(
                Guid.NewGuid(),
                tenantContext.TenantId,
                asset.Id,
                FixedAssetTransactionType.Transfer,
                request.TransactionDateUtc == default ? DateTime.UtcNow : request.TransactionDateUtc,
                0m,
                $"Transfer recorded for fixed asset {asset.AssetNumber}",
                reference: asset.AssetNumber,
                notes: request.Notes));

            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(new { Message = "Fixed asset transfer recorded successfully.", FixedAsset = asset });
        }
        catch (Exception ex) when (ex is InvalidOperationException or ArgumentException)
        {
            return Conflict(new { Message = ex.Message, FixedAssetId = fixedAssetId });
        }
    }

    [HttpPost("{fixedAssetId:guid}/reclassify")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> ReclassifyFixedAsset(
        Guid fixedAssetId,
        [FromBody] ReclassifyFixedAssetRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var asset = await dbContext.Set<FixedAsset>().FirstOrDefaultAsync(x => x.Id == fixedAssetId, cancellationToken);
        if (asset is null) return NotFound(new { Message = "Fixed asset was not found.", FixedAssetId = fixedAssetId });

        var targetClass = await dbContext.Set<FixedAssetClass>().AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.TargetFixedAssetClassId, cancellationToken);
        if (targetClass is null) return NotFound(new { Message = "Target fixed asset class was not found.", request.TargetFixedAssetClassId });
        if (targetClass.Status != FixedAssetClassStatus.Active) return Conflict(new { Message = "Only active fixed asset classes can be used for reclassification.", request.TargetFixedAssetClassId });

        try
        {
            asset.Reclassify(request.TargetFixedAssetClassId);
            dbContext.Add(new FixedAssetTransaction(
                Guid.NewGuid(),
                tenantContext.TenantId,
                asset.Id,
                FixedAssetTransactionType.Reclassification,
                request.TransactionDateUtc == default ? DateTime.UtcNow : request.TransactionDateUtc,
                0m,
                $"Reclassification recorded for fixed asset {asset.AssetNumber}",
                reference: asset.AssetNumber,
                notes: request.Notes));

            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(new { Message = "Fixed asset reclassification recorded successfully.", FixedAsset = asset, TargetFixedAssetClassId = targetClass.Id, TargetFixedAssetClassCode = targetClass.Code, TargetFixedAssetClassName = targetClass.Name });
        }
        catch (Exception ex) when (ex is InvalidOperationException or ArgumentException)
        {
            return Conflict(new { Message = ex.Message, FixedAssetId = fixedAssetId });
        }
    }

    [HttpPost("{fixedAssetId:guid}/impair")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> ImpairFixedAsset(
        Guid fixedAssetId,
        [FromBody] ImpairFixedAssetRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (request.Amount <= 0m) return BadRequest(new { Message = "Impairment amount must be greater than zero." });

        var asset = await dbContext.Set<FixedAsset>().FirstOrDefaultAsync(x => x.Id == fixedAssetId, cancellationToken);
        if (asset is null) return NotFound(new { Message = "Fixed asset was not found.", FixedAssetId = fixedAssetId });
        if (asset.Status == FixedAssetStatus.Draft) return Conflict(new { Message = "Draft fixed assets must be capitalized before impairment can be recorded.", FixedAssetId = fixedAssetId });

        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(dbContext, request.TransactionDateUtc, cancellationToken);
        if (postingPeriod is null) return Conflict(new { Message = "No open fiscal period exists for the impairment date.", request.TransactionDateUtc });

        var validation = await ValidateLedgerAccountsAsync(dbContext, new[] { asset.DepreciationExpenseLedgerAccountId, asset.AccumulatedDepreciationLedgerAccountId }, cancellationToken);
        if (validation is not null) return validation;

        var reference = string.IsNullOrWhiteSpace(request.Reference) ? $"FA-IMP-{asset.AssetNumber}-{request.TransactionDateUtc:yyyyMMdd}" : request.Reference.Trim().ToUpperInvariant();
        var referenceExists = await dbContext.JournalEntries.AsNoTracking().AnyAsync(x => x.Reference == reference, cancellationToken);
        if (referenceExists) return Conflict(new { Message = "A journal entry with the same impairment reference already exists.", Reference = reference });

        try
        {
            asset.Impair(request.Amount);

            var journalEntry = new JournalEntry(
                Guid.NewGuid(),
                tenantContext.TenantId,
                request.TransactionDateUtc,
                reference,
                string.IsNullOrWhiteSpace(request.Description) ? $"Fixed asset impairment - {asset.AssetNumber}" : request.Description.Trim(),
                JournalEntryStatus.Draft,
                JournalEntryType.Normal,
                new[]
                {
                    new JournalEntryLine(Guid.NewGuid(), asset.DepreciationExpenseLedgerAccountId, $"Impairment expense - {asset.AssetNumber}", request.Amount, 0m),
                    new JournalEntryLine(Guid.NewGuid(), asset.AccumulatedDepreciationLedgerAccountId, $"Impairment reserve - {asset.AssetNumber}", 0m, request.Amount)
                },
                postingRequiresApproval: false);

            journalEntry.MarkPosted(DateTime.UtcNow);
            var movements = journalEntry.Lines.Select(line => new LedgerMovement(
                Guid.NewGuid(),
                tenantContext.TenantId,
                journalEntry.Id,
                line.Id,
                line.LedgerAccountId,
                journalEntry.EntryDateUtc,
                journalEntry.Reference,
                line.Description,
                line.DebitAmount,
                line.CreditAmount)).ToList();

            dbContext.Add(journalEntry);
            dbContext.LedgerMovements.AddRange(movements);
            dbContext.Add(new FixedAssetTransaction(
                Guid.NewGuid(),
                tenantContext.TenantId,
                asset.Id,
                FixedAssetTransactionType.Impairment,
                request.TransactionDateUtc,
                request.Amount,
                $"Impairment recorded for fixed asset {asset.AssetNumber}",
                journalEntry.Id,
                reference,
                request.Description));

            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new { Message = "Fixed asset impairment recorded successfully.", FixedAsset = asset, JournalEntryId = journalEntry.Id, FiscalPeriodId = postingPeriod.Id, FiscalPeriodName = postingPeriod.Name });
        }
        catch (Exception ex) when (ex is InvalidOperationException or ArgumentException)
        {
            return Conflict(new { Message = ex.Message, FixedAssetId = fixedAssetId });
        }
    }

    [HttpPost("{fixedAssetId:guid}/dispose")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> DisposeFixedAsset(
        Guid fixedAssetId,
        [FromBody] DisposeFixedAssetRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var asset = await dbContext.Set<FixedAsset>().FirstOrDefaultAsync(x => x.Id == fixedAssetId, cancellationToken);
        if (asset is null) return NotFound(new { Message = "Fixed asset was not found.", FixedAssetId = fixedAssetId });
        if (asset.Status == FixedAssetStatus.Draft) return Conflict(new { Message = "Draft fixed assets cannot be disposed.", FixedAssetId = fixedAssetId });

        if (request.DisposalProceedsAmount > 0m && !request.CashOrBankLedgerAccountId.HasValue)
        {
            return BadRequest(new { Message = "Cash or bank ledger account is required when disposal proceeds amount is greater than zero." });
        }

        var disposalExists = await dbContext.Set<FixedAssetDisposal>().AsNoTracking().AnyAsync(x => x.FixedAssetId == fixedAssetId, cancellationToken);
        if (disposalExists)
        {
            return Conflict(new { Message = "A disposal record already exists for this fixed asset.", FixedAssetId = fixedAssetId });
        }

        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(dbContext, request.DisposalDateUtc, cancellationToken);
        if (postingPeriod is null) return Conflict(new { Message = "No open fiscal period exists for the disposal date.", request.DisposalDateUtc });

        var ledgerIds = new List<Guid>
        {
            asset.AssetCostLedgerAccountId,
            asset.AccumulatedDepreciationLedgerAccountId,
            asset.DisposalGainLossLedgerAccountId
        };

        if (request.CashOrBankLedgerAccountId.HasValue)
        {
            ledgerIds.Add(request.CashOrBankLedgerAccountId.Value);
        }

        var validation = await ValidateLedgerAccountsAsync(dbContext, ledgerIds, cancellationToken);
        if (validation is not null) return validation;

        var reference = string.IsNullOrWhiteSpace(request.Reference) ? $"FA-DISP-{asset.AssetNumber}-{request.DisposalDateUtc:yyyyMMdd}" : request.Reference.Trim().ToUpperInvariant();
        var referenceExists = await dbContext.JournalEntries.AsNoTracking().AnyAsync(x => x.Reference == reference, cancellationToken);
        if (referenceExists) return Conflict(new { Message = "A journal entry with the same disposal reference already exists.", Reference = reference });

        var netBookValue = asset.NetBookValue;
        var gainOrLoss = request.DisposalProceedsAmount - netBookValue;

        try
        {
            asset.Dispose(request.DisposalDateUtc, request.DisposalProceedsAmount);

            var journalLines = new List<JournalEntryLine>
            {
                new(Guid.NewGuid(), asset.AccumulatedDepreciationLedgerAccountId, $"Accumulated depreciation disposal - {asset.AssetNumber}", asset.AccumulatedDepreciationAmount, 0m),
                new(Guid.NewGuid(), asset.AssetCostLedgerAccountId, $"Fixed asset disposal - {asset.AssetNumber}", 0m, asset.AcquisitionCost)
            };

            if (request.DisposalProceedsAmount > 0m && request.CashOrBankLedgerAccountId.HasValue)
            {
                journalLines.Add(new JournalEntryLine(
                    Guid.NewGuid(),
                    request.CashOrBankLedgerAccountId.Value,
                    $"Disposal proceeds - {asset.AssetNumber}",
                    request.DisposalProceedsAmount,
                    0m));
            }

            if (gainOrLoss < 0m)
            {
                journalLines.Add(new JournalEntryLine(
                    Guid.NewGuid(),
                    asset.DisposalGainLossLedgerAccountId,
                    $"Loss on disposal - {asset.AssetNumber}",
                    Math.Abs(gainOrLoss),
                    0m));
            }
            else if (gainOrLoss > 0m)
            {
                journalLines.Add(new JournalEntryLine(
                    Guid.NewGuid(),
                    asset.DisposalGainLossLedgerAccountId,
                    $"Gain on disposal - {asset.AssetNumber}",
                    0m,
                    gainOrLoss));
            }

            var journalEntry = new JournalEntry(
                Guid.NewGuid(),
                tenantContext.TenantId,
                request.DisposalDateUtc,
                reference,
                string.IsNullOrWhiteSpace(request.Description) ? $"Fixed asset disposal - {asset.AssetNumber}" : request.Description.Trim(),
                JournalEntryStatus.Draft,
                JournalEntryType.Normal,
                journalLines,
                postingRequiresApproval: false);

            journalEntry.MarkPosted(DateTime.UtcNow);
            var movements = journalEntry.Lines.Select(line => new LedgerMovement(
                Guid.NewGuid(),
                tenantContext.TenantId,
                journalEntry.Id,
                line.Id,
                line.LedgerAccountId,
                journalEntry.EntryDateUtc,
                journalEntry.Reference,
                line.Description,
                line.DebitAmount,
                line.CreditAmount)).ToList();

            dbContext.Add(journalEntry);
            dbContext.LedgerMovements.AddRange(movements);
            dbContext.Add(new FixedAssetTransaction(
                Guid.NewGuid(),
                tenantContext.TenantId,
                asset.Id,
                FixedAssetTransactionType.Disposal,
                request.DisposalDateUtc,
                request.DisposalProceedsAmount,
                $"Disposal recorded for fixed asset {asset.AssetNumber}",
                journalEntry.Id,
                reference,
                request.Notes));
            dbContext.Add(new FixedAssetDisposal(
                Guid.NewGuid(),
                tenantContext.TenantId,
                asset.Id,
                request.DisposalType,
                request.DisposalDateUtc,
                request.DisposalProceedsAmount,
                netBookValue,
                gainOrLoss,
                string.IsNullOrWhiteSpace(request.Notes) ? $"Disposal of fixed asset {asset.AssetNumber}" : request.Notes.Trim(),
                journalEntry.Id));

            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Fixed asset disposal posted successfully.",
                FixedAsset = asset,
                Disposal = new
                {
                    DisposalDateUtc = request.DisposalDateUtc,
                    request.DisposalType,
                    request.DisposalProceedsAmount,
                    NetBookValueAtDisposal = netBookValue,
                    GainOrLossAmount = gainOrLoss
                },
                JournalEntryId = journalEntry.Id,
                FiscalPeriodId = postingPeriod.Id,
                FiscalPeriodName = postingPeriod.Name
            });
        }
        catch (Exception ex) when (ex is InvalidOperationException or ArgumentException)
        {
            return Conflict(new { Message = ex.Message, FixedAssetId = fixedAssetId });
        }
    }

    private static string? ValidateDepreciationPeriod(DateTime periodStartUtc, DateTime periodEndUtc)
    {
        if (periodStartUtc == default || periodEndUtc == default)
        {
            return "Depreciation period start and end dates are required.";
        }

        if (periodEndUtc < periodStartUtc)
        {
            return "Depreciation period end date cannot be earlier than the start date.";
        }

        return null;
    }

    private static async Task<List<FixedAsset>> GetDepreciationCandidateAssetsAsync(
        ApplicationDbContext dbContext,
        DateTime periodEndUtc,
        CancellationToken cancellationToken)
    {
        return await dbContext.Set<FixedAsset>()
            .Where(x => x.CapitalizationDateUtc.HasValue && x.CapitalizationDateUtc.Value <= periodEndUtc)
            .Where(x => x.Status != FixedAssetStatus.Draft && x.Status != FixedAssetStatus.Disposed)
            .OrderBy(x => x.AssetNumber)
            .ToListAsync(cancellationToken);
    }

    private static DepreciationPreviewItem? BuildDepreciationPreviewItem(FixedAsset asset, DateTime periodStartUtc, DateTime periodEndUtc, bool alreadyDepreciated)
    {
        if (alreadyDepreciated || asset.DepreciationMethod == FixedAssetDepreciationMethod.None)
        {
            return null;
        }

        if (!asset.CapitalizationDateUtc.HasValue || asset.CapitalizationDateUtc.Value > periodEndUtc)
        {
            return null;
        }

        if (asset.DisposedOnUtc.HasValue && asset.DisposedOnUtc.Value < periodStartUtc)
        {
            return null;
        }

        var periodDays = Math.Max(1, (periodEndUtc.Date - periodStartUtc.Date).Days + 1);
        var activeStart = asset.CapitalizationDateUtc.Value > periodStartUtc ? asset.CapitalizationDateUtc.Value.Date : periodStartUtc.Date;
        var activeEnd = asset.DisposedOnUtc.HasValue && asset.DisposedOnUtc.Value.Date < periodEndUtc.Date
            ? asset.DisposedOnUtc.Value.Date
            : periodEndUtc.Date;

        if (activeEnd < activeStart)
        {
            return null;
        }

        var activeDays = Math.Max(0, (activeEnd - activeStart).Days + 1);
        if (activeDays <= 0)
        {
            return null;
        }

        var openingNetBookValue = asset.NetBookValue;
        var monthlyAmount = asset.DepreciationMethod switch
        {
            FixedAssetDepreciationMethod.StraightLine => asset.DepreciableBase / asset.UsefulLifeMonths,
            FixedAssetDepreciationMethod.ReducingBalance => (Math.Max(0m, asset.NetBookValue - asset.ResidualValue) * (2m / asset.UsefulLifeMonths)),
            _ => 0m
        };

        var depreciationAmount = Math.Round(monthlyAmount * activeDays / periodDays, 2, MidpointRounding.AwayFromZero);
        var maxAllowed = Math.Max(0m, asset.NetBookValue - asset.ResidualValue);
        if (depreciationAmount > maxAllowed)
        {
            depreciationAmount = maxAllowed;
        }

        if (depreciationAmount <= 0m)
        {
            return null;
        }

        var closingNetBookValue = openingNetBookValue - depreciationAmount;

        return new DepreciationPreviewItem(
            asset.Id,
            asset.AssetNumber,
            asset.AssetName,
            asset.DepreciationExpenseLedgerAccountId,
            asset.AccumulatedDepreciationLedgerAccountId,
            asset.DepreciationMethod,
            openingNetBookValue,
            depreciationAmount,
            closingNetBookValue,
            activeDays,
            periodDays);
    }

    private static async Task<FiscalPeriod?> GetOpenFiscalPeriodForDateAsync(ApplicationDbContext dbContext, DateTime dateUtc, CancellationToken cancellationToken)
    {
        var dateOnly = DateOnly.FromDateTime(dateUtc.Date);
        return await dbContext.FiscalPeriods
            .FirstOrDefaultAsync(x => x.Status == FiscalPeriodStatus.Open && x.StartDate <= dateOnly && x.EndDate >= dateOnly, cancellationToken);
    }

    private static bool IsPostingReady(LedgerAccount ledgerAccount) => ledgerAccount.IsActive && !ledgerAccount.IsHeader && ledgerAccount.IsPostingAllowed;

    private static async Task<IActionResult?> ValidateLedgerAccountsAsync(ApplicationDbContext dbContext, IEnumerable<Guid> ledgerAccountIds, CancellationToken cancellationToken)
    {
        var ids = ledgerAccountIds.Where(x => x != Guid.Empty).Distinct().ToList();
        var accounts = await dbContext.LedgerAccounts.Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        if (accounts.Count != ids.Count)
        {
            return new BadRequestObjectResult(new { Message = "One or more selected ledger accounts were not found for the current tenant." });
        }

        foreach (var account in accounts.Values)
        {
            if (!IsPostingReady(account))
            {
                return new BadRequestObjectResult(new { Message = "All selected ledger accounts must be active, non-header, and posting-enabled.", account.Id, account.Code });
            }
        }

        return null;
    }

    private sealed record DepreciationPreviewItem(
        Guid FixedAssetId,
        string AssetNumber,
        string AssetName,
        Guid DepreciationExpenseLedgerAccountId,
        Guid AccumulatedDepreciationLedgerAccountId,
        FixedAssetDepreciationMethod DepreciationMethod,
        decimal OpeningNetBookValue,
        decimal DepreciationAmount,
        decimal ClosingNetBookValue,
        int ActiveDays,
        int PeriodDays);

    public sealed record CreateFixedAssetClassRequest(
        string Code,
        string Name,
        string? Description,
        decimal CapitalizationThreshold,
        decimal ResidualValuePercentDefault,
        int UsefulLifeMonthsDefault,
        FixedAssetDepreciationMethod DepreciationMethodDefault,
        Guid AssetCostLedgerAccountId,
        Guid AccumulatedDepreciationLedgerAccountId,
        Guid DepreciationExpenseLedgerAccountId,
        Guid DisposalGainLossLedgerAccountId);

    public sealed record CapitalizePurchaseInvoiceToFixedAssetRequest(
        Guid PurchaseInvoiceId,
        Guid FixedAssetClassId,
        string AssetNumber,
        string AssetName,
        string? Description,
        DateTime? CapitalizationDateUtc,
        decimal ResidualValue,
        int UsefulLifeMonths,
        FixedAssetDepreciationMethod DepreciationMethod,
        Guid AssetCostLedgerAccountId,
        Guid AccumulatedDepreciationLedgerAccountId,
        Guid DepreciationExpenseLedgerAccountId,
        Guid DisposalGainLossLedgerAccountId,
        string? Location,
        string? Custodian,
        string? SerialNumber,
        string? Notes);

    public sealed record CreateFixedAssetRequest(
        Guid FixedAssetClassId,
        string AssetNumber,
        string AssetName,
        string? Description,
        DateTime AcquisitionDateUtc,
        decimal AcquisitionCost,
        decimal ResidualValue,
        int UsefulLifeMonths,
        FixedAssetDepreciationMethod DepreciationMethod,
        Guid AssetCostLedgerAccountId,
        Guid AccumulatedDepreciationLedgerAccountId,
        Guid DepreciationExpenseLedgerAccountId,
        Guid DisposalGainLossLedgerAccountId,
        Guid? VendorId,
        Guid? PurchaseInvoiceId,
        string? Location,
        string? Custodian,
        string? SerialNumber,
        string? Notes);

    public sealed record CapitalizeFixedAssetRequest(DateTime CapitalizationDateUtc, Guid CreditLedgerAccountId, string? Reference, string? Description);
    public sealed record FixedAssetDepreciationPeriodRequest(DateTime PeriodStartUtc, DateTime PeriodEndUtc);
    public sealed record RunFixedAssetDepreciationRequest(DateTime PeriodStartUtc, DateTime PeriodEndUtc, DateTime RunDateUtc, string? Reference, string? Description);
    public sealed record FixedAssetImprovementRequest(DateTime TransactionDateUtc, decimal Amount, Guid CreditLedgerAccountId, int? UsefulLifeMonthsOverride, string? Reference, string? Description);
    public sealed record TransferFixedAssetRequest(DateTime TransactionDateUtc, string? Location, string? Custodian, string? Notes);
    public sealed record ReclassifyFixedAssetRequest(DateTime TransactionDateUtc, Guid TargetFixedAssetClassId, string? Notes);
    public sealed record ImpairFixedAssetRequest(DateTime TransactionDateUtc, decimal Amount, string? Reference, string? Description);
    public sealed record DisposeFixedAssetRequest(DateTime DisposalDateUtc, FixedAssetDisposalType DisposalType, decimal DisposalProceedsAmount, Guid? CashOrBankLedgerAccountId, string? Reference, string? Description, string? Notes);
}
