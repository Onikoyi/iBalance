# Tenancy Strategy - iBalance

## Tenancy Model for v1
Shared application with logical tenant isolation.

## v1 Data Isolation
- Single PostgreSQL database
- Every tenant-owned table contains `TenantId`
- Tenant-aware repository and query filters
- No cross-tenant queries in application logic
- Tenant context resolved per request

## Future Tiers
### Tier A
Shared database with row-level logical isolation

### Tier B
Schema-per-tenant for premium customers

### Tier C
Database-per-tenant for highly regulated customers

## v1 Rules
- Every business entity tied to a tenant
- Audit records tied to tenant and actor
- Background jobs must execute in tenant scope
- Imports and exports must be tenant-scoped