using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEnterpriseAccessControlFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OrganizationBranches",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationBranches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationCostCenters",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationCostCenters", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationDepartments",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationDepartments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SecurityPermissions",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Module = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Action = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsSystemDefined = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SecurityPermissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SecurityRoles",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsSystemDefined = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SecurityRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserScopeAssignments",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScopeType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ScopeEntityId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScopeCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    ScopeName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserScopeAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserScopeAssignments_UserAccounts_UserAccountId",
                        column: x => x.UserAccountId,
                        principalSchema: "platform",
                        principalTable: "UserAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DepartmentWorkflowPolicies",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ModuleCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    OrganizationDepartmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    MakerCheckerRequired = table.Column<bool>(type: "boolean", nullable: false),
                    EnforceSegregationOfDuties = table.Column<bool>(type: "boolean", nullable: false),
                    MinimumApproverCount = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DepartmentWorkflowPolicies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DepartmentWorkflowPolicies_OrganizationDepartments_Organiza~",
                        column: x => x.OrganizationDepartmentId,
                        principalSchema: "platform",
                        principalTable: "OrganizationDepartments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SecurityRolePermissions",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SecurityRoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    SecurityPermissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SecurityRolePermissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SecurityRolePermissions_SecurityPermissions_SecurityPermiss~",
                        column: x => x.SecurityPermissionId,
                        principalSchema: "platform",
                        principalTable: "SecurityPermissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SecurityRolePermissions_SecurityRoles_SecurityRoleId",
                        column: x => x.SecurityRoleId,
                        principalSchema: "platform",
                        principalTable: "SecurityRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserSecurityRoleAssignments",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    SecurityRoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSecurityRoleAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserSecurityRoleAssignments_SecurityRoles_SecurityRoleId",
                        column: x => x.SecurityRoleId,
                        principalSchema: "platform",
                        principalTable: "SecurityRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserSecurityRoleAssignments_UserAccounts_UserAccountId",
                        column: x => x.UserAccountId,
                        principalSchema: "platform",
                        principalTable: "UserAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentWorkflowPolicies_OrganizationDepartmentId",
                schema: "platform",
                table: "DepartmentWorkflowPolicies",
                column: "OrganizationDepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentWorkflowPolicies_TenantId_ModuleCode_Organization~",
                schema: "platform",
                table: "DepartmentWorkflowPolicies",
                columns: new[] { "TenantId", "ModuleCode", "OrganizationDepartmentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationBranches_TenantId_Code",
                schema: "platform",
                table: "OrganizationBranches",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationCostCenters_TenantId_Code",
                schema: "platform",
                table: "OrganizationCostCenters",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationDepartments_TenantId_Code",
                schema: "platform",
                table: "OrganizationDepartments",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SecurityPermissions_TenantId_Code",
                schema: "platform",
                table: "SecurityPermissions",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SecurityRolePermissions_SecurityPermissionId",
                schema: "platform",
                table: "SecurityRolePermissions",
                column: "SecurityPermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_SecurityRolePermissions_SecurityRoleId",
                schema: "platform",
                table: "SecurityRolePermissions",
                column: "SecurityRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_SecurityRolePermissions_TenantId_SecurityRoleId_SecurityPer~",
                schema: "platform",
                table: "SecurityRolePermissions",
                columns: new[] { "TenantId", "SecurityRoleId", "SecurityPermissionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SecurityRoles_TenantId_Code",
                schema: "platform",
                table: "SecurityRoles",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserScopeAssignments_TenantId_UserAccountId_ScopeType_Scope~",
                schema: "platform",
                table: "UserScopeAssignments",
                columns: new[] { "TenantId", "UserAccountId", "ScopeType", "ScopeEntityId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserScopeAssignments_UserAccountId",
                schema: "platform",
                table: "UserScopeAssignments",
                column: "UserAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_UserSecurityRoleAssignments_SecurityRoleId",
                schema: "platform",
                table: "UserSecurityRoleAssignments",
                column: "SecurityRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_UserSecurityRoleAssignments_TenantId_UserAccountId_Security~",
                schema: "platform",
                table: "UserSecurityRoleAssignments",
                columns: new[] { "TenantId", "UserAccountId", "SecurityRoleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserSecurityRoleAssignments_UserAccountId",
                schema: "platform",
                table: "UserSecurityRoleAssignments",
                column: "UserAccountId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DepartmentWorkflowPolicies",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "OrganizationBranches",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "OrganizationCostCenters",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "SecurityRolePermissions",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "UserScopeAssignments",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "UserSecurityRoleAssignments",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "OrganizationDepartments",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "SecurityPermissions",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "SecurityRoles",
                schema: "platform");
        }
    }
}
