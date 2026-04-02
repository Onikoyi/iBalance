# iBalance

iBalance is a production-grade, cloud-based, multi-tenant accounting platform designed for multiple sectors including Universities, Oil & Gas, Banking, NGOs, and other enterprise domains.

## Vision
Build a secure, auditable, modular, and commercially viable accounting platform with a shared finance core and sector-specific extensions.

## v1 Scope
- Multi-tenant SaaS foundation
- Identity and access control
- General Ledger
- Chart of Accounts
- Journal posting engine
- Accounts Payable
- Accounts Receivable
- Cash and Bank
- Audit trail
- Reporting foundation
- Universities sector pack
- Oil & Gas sector pack

## Repository Structure
- `docs` - product, architecture, runbooks
- `apps` - entry applications
- `src` - business modules and shared building blocks
- `tests` - automated tests
- `infrastructure` - docker and terraform
- `scripts` - developer and deployment scripts

## Build Strategy
- Modular monolith first
- API-first architecture
- PostgreSQL as primary database
- Redis for caching and distributed concerns
- Docker-based local and pilot deployment
- AWS Lightsail for low-cost early deployment

## Delivery Principles
- Production-ready code only
- Strong auditability
- Tenant isolation at every layer
- Sector-specific extensibility without polluting the finance core