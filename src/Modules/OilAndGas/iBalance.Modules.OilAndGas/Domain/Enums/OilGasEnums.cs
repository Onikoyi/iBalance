namespace iBalance.Modules.OilAndGas.Domain.Enums;

public enum OilGasAssetType { UpstreamAsset = 1, Field = 2, Terminal = 3, Depot = 4, GasPlant = 5, PipelineSystem = 6, RetailNetwork = 7, ServiceProject = 8 }
public enum OilGasLocationType { Facility = 1, FlowStation = 2, Well = 3, TankFarm = 4, Tank = 5, MeteringPoint = 6, PipelineSegment = 7, LoadingBay = 8, RetailStation = 9, Other = 10 }
public enum OilGasProductCategory { CrudeOil = 1, Condensate = 2, NaturalGas = 3, PMS = 4, AGO = 5, DPK = 6, LPG = 7, CNG = 8, ProducedWater = 9, Other = 10 }
public enum OilGasProductionStatus { Draft = 0, Submitted = 1, Approved = 2, Rejected = 3, Closed = 4 }
public enum OilGasPermitStatus { Active = 1, Suspended = 2, Expired = 3, Renewed = 4, Cancelled = 5 }
public enum OilGasMeterStatus { Active = 1, OutOfService = 2, DueForCalibration = 3, UnderCalibration = 4, Retired = 5 }
public enum OilGasTankStatus { Active = 1, Maintenance = 2, Quarantined = 3, Retired = 4 }
public enum OilGasStockMovementType { ProductionReceipt = 1, ExternalReceipt = 2, TankTransfer = 3, LiftingDelivery = 4, OperationalConsumption = 5, MeasurementAdjustment = 6, ApprovedLoss = 7, Return = 8 }
public enum OilGasStockMovementStatus { Draft = 0, Submitted = 1, Approved = 2, Rejected = 3, Posted = 4, Cancelled = 5 }
public enum OilGasTransportType { None = 0, Vessel = 1, Truck = 2, Pipeline = 3, Rail = 4, Other = 5 }

public enum OilGasLiftingStatus { Draft = 0, Submitted = 1, Approved = 2, Rejected = 3, Completed = 4, Cancelled = 5 }
public enum OilGasAfeStatus { Draft = 0, Submitted = 1, Approved = 2, Rejected = 3, Closed = 4, Cancelled = 5 }
public enum OilGasPartnerFundingType { CashCall = 1, FundingReceipt = 2, ExpenditureAllocation = 3, Adjustment = 4 }
public enum OilGasProductionPeriodStatus { Open = 0, Submitted = 1, Approved = 2, Rejected = 3, Closed = 4 }
public enum OilGasHseSeverity { Low = 1, Moderate = 2, High = 3, Critical = 4 }
public enum OilGasHseStatus { Open = 0, CorrectiveAction = 1, PendingClosure = 2, Closed = 3 }
public enum OilGasEquipmentStatus { Operational = 1, UnderMaintenance = 2, OutOfService = 3, Retired = 4 }
public enum OilGasDocumentType { Permit = 1, CalibrationCertificate = 2, LiftingDocument = 3, ProductionEvidence = 4, HseEvidence = 5, AfeEvidence = 6, PartnerDocument = 7, EquipmentCertificate = 8, Other = 9 }
