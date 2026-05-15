using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseAdvanceManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ExpenseAdvancePolicies",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MaxAmount = table.Column<decimal>(type: "numeric", nullable: true),
                    MaxOpenAdvancesPerStaff = table.Column<int>(type: "integer", nullable: false),
                    RetirementDueDays = table.Column<int>(type: "integer", nullable: false),
                    AttachmentsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    BlockSelfApproval = table.Column<bool>(type: "boolean", nullable: false),
                    AllowExcessReimbursement = table.Column<bool>(type: "boolean", nullable: false),
                    AllowSalaryRecovery = table.Column<bool>(type: "boolean", nullable: false),
                    RequireDepartmentScope = table.Column<bool>(type: "boolean", nullable: false),
                    RequireBranchScope = table.Column<bool>(type: "boolean", nullable: false),
                    RequireCostCenterScope = table.Column<bool>(type: "boolean", nullable: false),
                    ImprestAutoCloseOnFullRetirement = table.Column<bool>(type: "boolean", nullable: false),
                    TravelRequiresDestination = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseAdvancePolicies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExpenseAdvancePostingSetups",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AdvanceTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    AdvanceControlAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    DefaultExpenseAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    RefundAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    SalaryRecoveryAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    JournalRecoveryAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReimbursementPayableAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    ClearingAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    DefaultCashOrBankAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseAdvancePostingSetups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExpenseAdvanceRequests",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AdvanceTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestNumber = table.Column<string>(type: "text", nullable: false),
                    RequestDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Purpose = table.Column<string>(type: "text", nullable: false),
                    RequestedAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    DisbursedAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    RetiredAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    RefundedAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    RecoveredAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    ReimbursedAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    OutstandingAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    Department = table.Column<string>(type: "text", nullable: true),
                    Branch = table.Column<string>(type: "text", nullable: true),
                    CostCenter = table.Column<string>(type: "text", nullable: true),
                    Destination = table.Column<string>(type: "text", nullable: true),
                    ExpectedRetirementDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<string>(type: "text", nullable: true),
                    RejectedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedBy = table.Column<string>(type: "text", nullable: true),
                    RejectionReason = table.Column<string>(type: "text", nullable: true),
                    DisbursedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DisbursedBy = table.Column<string>(type: "text", nullable: true),
                    DisbursementJournalEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseAdvanceRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExpenseAdvanceRetirements",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AdvanceRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    RetirementNumber = table.Column<string>(type: "text", nullable: false),
                    RetirementDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReasonCode = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TotalExpenseAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    RefundAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    RecoverableAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    ReimbursableAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    PostingJournalEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    SubmittedBy = table.Column<string>(type: "text", nullable: true),
                    SubmittedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<string>(type: "text", nullable: true),
                    ApprovedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedBy = table.Column<string>(type: "text", nullable: true),
                    RejectedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "text", nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseAdvanceRetirements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExpenseAdvanceTypes",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    RequiresRetirement = table.Column<bool>(type: "boolean", nullable: false),
                    IsImprest = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseAdvanceTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExpenseCategories",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    DefaultExpenseLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExpenseAdvanceRetirementLines",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ExpenseAdvanceRetirementId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExpenseCategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseAdvanceRetirementLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExpenseAdvanceRetirementLines_ExpenseAdvanceRetirements_Exp~",
                        column: x => x.ExpenseAdvanceRetirementId,
                        principalSchema: "public",
                        principalTable: "ExpenseAdvanceRetirements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseAdvanceRetirementLines_ExpenseAdvanceRetirementId",
                schema: "public",
                table: "ExpenseAdvanceRetirementLines",
                column: "ExpenseAdvanceRetirementId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExpenseAdvancePolicies",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ExpenseAdvancePostingSetups",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ExpenseAdvanceRequests",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ExpenseAdvanceRetirementLines",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ExpenseAdvanceTypes",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ExpenseCategories",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ExpenseAdvanceRetirements",
                schema: "public");
        }
    }
}
