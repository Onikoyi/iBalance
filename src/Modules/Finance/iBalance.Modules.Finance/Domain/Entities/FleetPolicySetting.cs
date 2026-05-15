namespace iBalance.Modules.Finance.Domain.Entities;

public class FleetPolicySetting
{
    private FleetPolicySetting() { }

    public FleetPolicySetting(
        Guid id,
        Guid tenantId,
        Guid fuelExpenseLedgerAccountId,
        Guid maintenanceExpenseLedgerAccountId,
        Guid tripExpenseLedgerAccountId,
        Guid payableOrCashLedgerAccountId,
        bool requiresMakerCheckerForFuel,
        bool requiresMakerCheckerForMaintenance,
        bool requiresTripApproval,
        decimal maxFuelAmountPerEntry,
        string? notes)
    {
        Id = id;
        TenantId = tenantId;
        FuelExpenseLedgerAccountId = fuelExpenseLedgerAccountId;
        MaintenanceExpenseLedgerAccountId = maintenanceExpenseLedgerAccountId;
        TripExpenseLedgerAccountId = tripExpenseLedgerAccountId;
        PayableOrCashLedgerAccountId = payableOrCashLedgerAccountId;
        RequiresMakerCheckerForFuel = requiresMakerCheckerForFuel;
        RequiresMakerCheckerForMaintenance = requiresMakerCheckerForMaintenance;
        RequiresTripApproval = requiresTripApproval;
        MaxFuelAmountPerEntry = maxFuelAmountPerEntry;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid FuelExpenseLedgerAccountId { get; private set; }
    public Guid MaintenanceExpenseLedgerAccountId { get; private set; }
    public Guid TripExpenseLedgerAccountId { get; private set; }
    public Guid PayableOrCashLedgerAccountId { get; private set; }
    public bool RequiresMakerCheckerForFuel { get; private set; }
    public bool RequiresMakerCheckerForMaintenance { get; private set; }
    public bool RequiresTripApproval { get; private set; }
    public decimal MaxFuelAmountPerEntry { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public DateTime? LastModifiedOnUtc { get; private set; }

    public void Update(
        Guid fuelExpenseLedgerAccountId,
        Guid maintenanceExpenseLedgerAccountId,
        Guid tripExpenseLedgerAccountId,
        Guid payableOrCashLedgerAccountId,
        bool requiresMakerCheckerForFuel,
        bool requiresMakerCheckerForMaintenance,
        bool requiresTripApproval,
        decimal maxFuelAmountPerEntry,
        string? notes)
    {
        FuelExpenseLedgerAccountId = fuelExpenseLedgerAccountId;
        MaintenanceExpenseLedgerAccountId = maintenanceExpenseLedgerAccountId;
        TripExpenseLedgerAccountId = tripExpenseLedgerAccountId;
        PayableOrCashLedgerAccountId = payableOrCashLedgerAccountId;
        RequiresMakerCheckerForFuel = requiresMakerCheckerForFuel;
        RequiresMakerCheckerForMaintenance = requiresMakerCheckerForMaintenance;
        RequiresTripApproval = requiresTripApproval;
        MaxFuelAmountPerEntry = maxFuelAmountPerEntry;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}
