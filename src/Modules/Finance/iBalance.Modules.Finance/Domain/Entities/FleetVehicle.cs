using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public class FleetVehicle
{
    private FleetVehicle() { }

    public FleetVehicle(
        Guid id,
        Guid tenantId,
        string vehicleCode,
        string registrationNumber,
        string vehicleName,
        string vehicleType,
        string make,
        string model,
        int yearOfManufacture,
        Guid? organizationDepartmentId,
        Guid? organizationBranchId,
        Guid? organizationCostCenterId,
        string? notes)
    {
        if (string.IsNullOrWhiteSpace(vehicleCode))
        {
            throw new ArgumentException("Vehicle code is required.", nameof(vehicleCode));
        }

        if (string.IsNullOrWhiteSpace(registrationNumber))
        {
            throw new ArgumentException("Registration number is required.", nameof(registrationNumber));
        }

        if (string.IsNullOrWhiteSpace(vehicleName))
        {
            throw new ArgumentException("Vehicle name is required.", nameof(vehicleName));
        }

        if (string.IsNullOrWhiteSpace(vehicleType))
        {
            throw new ArgumentException("Vehicle type is required.", nameof(vehicleType));
        }

        Id = id;
        TenantId = tenantId;
        VehicleCode = vehicleCode.Trim().ToUpperInvariant();
        RegistrationNumber = registrationNumber.Trim().ToUpperInvariant();
        VehicleName = vehicleName.Trim();
        VehicleType = vehicleType.Trim();
        Make = make?.Trim() ?? string.Empty;
        Model = model?.Trim() ?? string.Empty;
        YearOfManufacture = yearOfManufacture;
        OrganizationDepartmentId = organizationDepartmentId;
        OrganizationBranchId = organizationBranchId;
        OrganizationCostCenterId = organizationCostCenterId;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        Status = FleetVehicleStatus.Active;
        IsActive = true;
        CurrentOdometerKm = 0m;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string VehicleCode { get; private set; } = string.Empty;
    public string RegistrationNumber { get; private set; } = string.Empty;
    public string VehicleName { get; private set; } = string.Empty;
    public string VehicleType { get; private set; } = string.Empty;
    public string Make { get; private set; } = string.Empty;
    public string Model { get; private set; } = string.Empty;
    public int YearOfManufacture { get; private set; }
    public string? ChassisNumber { get; private set; }
    public string? EngineNumber { get; private set; }
    public string? FuelType { get; private set; }
    public decimal CurrentOdometerKm { get; private set; }
    public decimal? OdometerAtLastServiceKm { get; private set; }
    public Guid? DefaultDriverId { get; private set; }
    public Guid? OrganizationDepartmentId { get; private set; }
    public Guid? OrganizationBranchId { get; private set; }
    public Guid? OrganizationCostCenterId { get; private set; }
    public DateTime? InsuranceExpiryUtc { get; private set; }
    public DateTime? RoadWorthinessExpiryUtc { get; private set; }
    public DateTime? LicenseExpiryUtc { get; private set; }
    public string? Notes { get; private set; }
    public FleetVehicleStatus Status { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public DateTime? LastModifiedOnUtc { get; private set; }

    public void Update(
        string vehicleName,
        string vehicleType,
        string make,
        string model,
        int yearOfManufacture,
        Guid? defaultDriverId,
        Guid? organizationDepartmentId,
        Guid? organizationBranchId,
        Guid? organizationCostCenterId,
        string? chassisNumber,
        string? engineNumber,
        string? fuelType,
        DateTime? insuranceExpiryUtc,
        DateTime? roadWorthinessExpiryUtc,
        DateTime? licenseExpiryUtc,
        string? notes)
    {
        if (string.IsNullOrWhiteSpace(vehicleName))
        {
            throw new ArgumentException("Vehicle name is required.", nameof(vehicleName));
        }

        if (string.IsNullOrWhiteSpace(vehicleType))
        {
            throw new ArgumentException("Vehicle type is required.", nameof(vehicleType));
        }

        VehicleName = vehicleName.Trim();
        VehicleType = vehicleType.Trim();
        Make = make?.Trim() ?? string.Empty;
        Model = model?.Trim() ?? string.Empty;
        YearOfManufacture = yearOfManufacture;
        DefaultDriverId = defaultDriverId;
        OrganizationDepartmentId = organizationDepartmentId;
        OrganizationBranchId = organizationBranchId;
        OrganizationCostCenterId = organizationCostCenterId;
        ChassisNumber = string.IsNullOrWhiteSpace(chassisNumber) ? null : chassisNumber.Trim();
        EngineNumber = string.IsNullOrWhiteSpace(engineNumber) ? null : engineNumber.Trim();
        FuelType = string.IsNullOrWhiteSpace(fuelType) ? null : fuelType.Trim();
        InsuranceExpiryUtc = insuranceExpiryUtc;
        RoadWorthinessExpiryUtc = roadWorthinessExpiryUtc;
        LicenseExpiryUtc = licenseExpiryUtc;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void SetOdometer(decimal odometerKm)
    {
        if (odometerKm < CurrentOdometerKm)
        {
            throw new ArgumentException("Odometer cannot move backwards.", nameof(odometerKm));
        }

        CurrentOdometerKm = odometerKm;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        Status = FleetVehicleStatus.Active;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void Suspend()
    {
        IsActive = false;
        Status = FleetVehicleStatus.Suspended;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void MarkUnderMaintenance()
    {
        Status = FleetVehicleStatus.UnderMaintenance;
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}
