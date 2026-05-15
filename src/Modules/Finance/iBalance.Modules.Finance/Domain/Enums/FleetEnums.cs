namespace iBalance.Modules.Finance.Domain.Enums;

public enum FleetVehicleStatus { 
    Draft = 1, 
    Active = 2, 
    UnderMaintenance = 3, 
    Suspended = 4, 
    Decommissioned = 5 }

public enum FleetTripStatus { 
    Draft = 1, 
    Submitted = 2, 
    Approved = 3, 
    Rejected = 4, 
    Posted = 5, 
    Cancelled = 6 }

public enum FleetPostingStatus { 
    Draft = 1, 
    Submitted = 2, 
    Approved = 3, 
    Rejected = 4, 
    Posted = 5, 
    Cancelled = 6 }