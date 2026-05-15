using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public class FleetTrip
{
    private FleetTrip() { }

    public FleetTrip(
        Guid id,
        Guid tenantId,
        string tripNumber,
        Guid vehicleId,
        Guid driverId,
        DateTime tripDateUtc,
        string origin,
        string destination,
        decimal startOdometerKm,
        string purpose,
        Guid? organizationDepartmentId,
        Guid? organizationBranchId,
        Guid? organizationCostCenterId,
        string? notes)
    {
        if (string.IsNullOrWhiteSpace(tripNumber))
        {
            throw new ArgumentException("Trip number is required.", nameof(tripNumber));
        }

        if (string.IsNullOrWhiteSpace(origin))
        {
            throw new ArgumentException("Origin is required.", nameof(origin));
        }

        if (string.IsNullOrWhiteSpace(destination))
        {
            throw new ArgumentException("Destination is required.", nameof(destination));
        }

        if (string.IsNullOrWhiteSpace(purpose))
        {
            throw new ArgumentException("Purpose is required.", nameof(purpose));
        }

        Id = id;
        TenantId = tenantId;
        TripNumber = tripNumber.Trim().ToUpperInvariant();
        VehicleId = vehicleId;
        DriverId = driverId;
        TripDateUtc = tripDateUtc;
        Origin = origin.Trim();
        Destination = destination.Trim();
        StartOdometerKm = startOdometerKm;
        Purpose = purpose.Trim();
        OrganizationDepartmentId = organizationDepartmentId;
        OrganizationBranchId = organizationBranchId;
        OrganizationCostCenterId = organizationCostCenterId;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        Status = FleetTripStatus.Draft;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string TripNumber { get; private set; } = string.Empty;
    public Guid VehicleId { get; private set; }
    public Guid DriverId { get; private set; }
    public DateTime TripDateUtc { get; private set; }
    public string Origin { get; private set; } = string.Empty;
    public string Destination { get; private set; } = string.Empty;
    public decimal StartOdometerKm { get; private set; }
    public decimal? EndOdometerKm { get; private set; }
    public decimal DistanceKm => EndOdometerKm.HasValue && EndOdometerKm.Value >= StartOdometerKm
        ? EndOdometerKm.Value - StartOdometerKm
        : 0m;
    public string Purpose { get; private set; } = string.Empty;
    public Guid? OrganizationDepartmentId { get; private set; }
    public Guid? OrganizationBranchId { get; private set; }
    public Guid? OrganizationCostCenterId { get; private set; }
    public string? Notes { get; private set; }
    public FleetTripStatus Status { get; private set; }
    public string? SubmittedBy { get; private set; }
    public DateTime? SubmittedOnUtc { get; private set; }
    public string? ApprovedBy { get; private set; }
    public DateTime? ApprovedOnUtc { get; private set; }
    public string? RejectedBy { get; private set; }
    public DateTime? RejectedOnUtc { get; private set; }
    public string? RejectionReason { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public DateTime? LastModifiedOnUtc { get; private set; }

    public void Update(
        DateTime tripDateUtc,
        string origin,
        string destination,
        decimal startOdometerKm,
        decimal? endOdometerKm,
        string purpose,
        string? notes)
    {
        if (Status != FleetTripStatus.Draft && Status != FleetTripStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected trips can be edited.");
        }

        TripDateUtc = tripDateUtc;
        Origin = origin.Trim();
        Destination = destination.Trim();
        StartOdometerKm = startOdometerKm;
        EndOdometerKm = endOdometerKm;
        Purpose = purpose.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void Submit(string submittedBy)
    {
        if (Status != FleetTripStatus.Draft && Status != FleetTripStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected trips can be submitted.");
        }

        SubmittedBy = submittedBy;
        SubmittedOnUtc = DateTime.UtcNow;
        Status = FleetTripStatus.Submitted;
    }

    public void Approve(string approvedBy)
    {
        if (Status != FleetTripStatus.Submitted)
        {
            throw new InvalidOperationException("Only submitted trips can be approved.");
        }

        ApprovedBy = approvedBy;
        ApprovedOnUtc = DateTime.UtcNow;
        Status = FleetTripStatus.Approved;
    }

    public void Reject(string rejectedBy, string reason)
    {
        if (Status != FleetTripStatus.Submitted)
        {
            throw new InvalidOperationException("Only submitted trips can be rejected.");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Rejection reason is required.", nameof(reason));
        }

        RejectedBy = rejectedBy;
        RejectedOnUtc = DateTime.UtcNow;
        RejectionReason = reason.Trim();
        Status = FleetTripStatus.Rejected;
    }

    public void Post()
    {
        if (Status != FleetTripStatus.Approved)
        {
            throw new InvalidOperationException("Only approved trips can be posted.");
        }

        Status = FleetTripStatus.Posted;
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}
