# Solution Architecture - iBalance

## Architecture Style
Modular monolith

## Primary Stack
- Frontend: Next.js + TypeScript
- Backend: .NET 8 Web API
- Database: PostgreSQL
- Cache: Redis
- Infrastructure: Docker Compose initially, Terraform for cloud provisioning
- Deployment target: AWS Lightsail for first pilot

## Core Principles
- Shared accounting core
- Sector extensions in isolated modules
- Tenant-aware services and data access
- Clear domain boundaries
- Immutable posted journal strategy
- Auditability by default

## Top-Level Components
- Web application
- API application
- Platform module
- Finance module
- Universities module
- OilAndGas module
- Shared building blocks
- Infrastructure layer

## Deployment Strategy
### Local
- Docker Compose for PostgreSQL and Redis
- API and Web run locally

### Pilot Production
- Linux VM on AWS Lightsail
- Docker Compose deployment
- Reverse proxy and TLS later in deployment phase

## Future Evolution
- Extract selected services only when justified by scale or workload isolation