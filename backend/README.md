# HRMS Backend (.NET 10)

ASP.NET Core 10 Web API for the Angular HRMS frontend. Code-first EF Core on SQL
Server LocalDB, JWT authentication with role-based authorisation, and a repository
+ unit-of-work persistence layer.

## Architecture

```
backend/
  Hrms.slnx
  src/
    Hrms.Domain/          Entities + enums (no dependencies)
    Hrms.Application/     DTOs, repository/service contracts, business services
    Hrms.Infrastructure/  EF Core DbContext, configurations, migrations,
                          repositories, unit of work, JWT, password hashing, seed
    Hrms.Api/             Controllers, auth setup, Swagger, error middleware
```

Request flow: `Controller → Application service → IUnitOfWork → Repository<T> → EF Core`.
Application services never reference `DbContext` or EF Core — they only use the
repository contracts in `Hrms.Application.Abstractions.Persistence`.

## Prerequisites

- .NET SDK 10 (`dotnet --version` → 10.x)
- SQL Server LocalDB (`sqllocaldb info MSSQLLocalDB`)

## Run

```bash
cd backend
dotnet run --project src/Hrms.Api
```

- API: <http://localhost:5096>
- Swagger UI: <http://localhost:5096/swagger>
- Health: <http://localhost:5096/health>

The API applies EF Core migrations and seeds demo data automatically on startup,
so the first run creates `HrmsDb` in LocalDB.

On startup the API also migrates the **master registry database** (`HRMS_Master`),
registers the default company and, for each company, keeps its own dedicated
database up to date (see [Multi-tenancy](#multi-tenancy)).

## Seeded logins

| Role        | Email                  | Password        | Display name   |
|-------------|------------------------|-----------------|----------------|
| Super Admin | `admin@hrnexus.com`    | `Admin@123`     | Alex Johnson   |
| HR Manager  | `hr@hrnexus.com`       | `Hr@12345`      | HR Manager     |
| Manager     | `manager@hrnexus.com`  | `Manager@123`   | Manager        |
| Employee    | `sarah@hrnexus.com`    | `Employee@123`  | Sarah Mitchell |

`POST /api/auth/login` returns `{ accessToken, expiresAtUtc, user }`. Use the token
as `Authorization: Bearer <token>`.

## Auth & roles

- `Super Admin`, `HR Manager` → policy `HrAdmin` (full HR management)
- `Manager` → policy `ManagerOrAbove` (approvals)
- `Employee` → self-service reads and requests
- All endpoints except `POST /api/auth/login` and `/health` require a valid JWT.

## Endpoint map

| Area | Routes |
|---|---|
| Auth | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| Employees | `GET/POST /api/employees`, `GET/PUT/DELETE /api/employees/{id}`, `GET /api/employees/department-headcount` |
| Leave | `GET/POST/PUT/DELETE /api/leave/types…`, `GET/POST /api/leave/requests`, `POST …/approve`, `POST …/reject`, `GET /api/leave/balances/{employeeId}` |
| Attendance | `GET /api/attendance/summary`, `…/today`, `…/employee/{id}`, `…/muster/{id}`, `GET/POST …/regularizations`, `POST …/regularizations/{id}/approve|reject` |
| Payroll | `GET /api/payroll/summary`, `…/runs`, `…/runs/{id}/payslips`, `…/employees/{id}/payslips`, `POST /api/payroll/run` |
| Loans | `GET /api/loans`, `GET /api/loans/summary`, `GET /api/loans/employee/{id}`, `POST /api/loans`, `POST /api/loans/{id}/approve|reject` |
| Documents | `GET /api/documents`, `…/company`, `…/summary`, `POST`, `DELETE /{id}` |
| Approvals | `GET /api/approvals`, `…/summary`, `POST`, `POST /{id}/approve|reject`, `POST /approve-all` |
| Organisation | `GET/POST/PUT/DELETE /api/organization/departments…`, `designations`, `branches`, `holidays`, `shifts` |
| Announcements | `GET/POST/PUT/DELETE /api/announcements` |
| Notifications | `GET /api/notifications`, `POST /api/notifications/{id}/read` |
| Dashboard | `GET /api/dashboard/stats`, `…/department-headcount`, `…/attendance-trend`, `…/activity`, `…/document-alerts`, `…/pending-approvals`, `…/recent-leaves` |
| Companies (Super Admin) | `GET/POST /api/companies`, `GET/PUT /api/companies/{id}`, `POST /api/companies/{id}/activate\|suspend\|retry-provisioning\|resend-invitation` |
| Activation | `GET /api/auth/activate?token=…`, `POST /api/auth/activate` |

Enums are serialised as strings (e.g. `"Approved"`, `"Active"`, `"Processed"`) and
JSON uses camelCase.

## Multi-tenancy

Every company created by the Super Admin gets its **own dedicated SQL Server
database**, initialized with the application schema only — no data is copied from
any other company. Company → database mappings live in a central **master**
database, and tenant identity is resolved server-side from the validated JWT, never
from a client-supplied database name.

**Databases**

| Database | Purpose | Config key |
|---|---|---|
| `HRMS` (default tenant) | The built-in company backed by the primary connection | `ConnectionStrings:DefaultConnection` |
| `HRMS_Master` | Company registry, invitations, provisioning logs | `ConnectionStrings:MasterConnection` |
| `hrms_t_<slug>` | One per created company | generated server-side |

Tenant connections are built from `Tenancy:TenantConnectionBase` (runtime,
least-privilege) and `Tenancy:ProvisioningConnectionBase` (elevated, used to create
databases) with the database name set via `SqlConnectionStringBuilder` — never by
string concatenation. Both default to `DefaultConnection` for local development.

**Provisioning workflow** (`POST /api/companies`), idempotent and safe to retry:

1. Validate the request and reject duplicate company codes.
2. Create the company record with status `Provisioning`.
3. Generate a sanitized, unique database name (`hrms_t_<slug>`, `[A-Za-z0-9_]`).
4. Create the database and apply the tenant migrations **only** (schema, no data).
5. Bootstrap the minimal defaults: roles, the admin login (random unusable
   password), a company settings row and default leave types.
6. Create an activation invitation (only the SHA-256 token hash is stored).
7. Send the activation email (only after the database is ready).
8. Mark the company `Active`.

Any database-step failure sets the company to `Failed` and records the error;
`POST /api/companies/{id}/retry-provisioning` re-runs the remaining steps without
duplicating the database, the admin, or the invitation.

**Login & isolation** — `POST /api/auth/login` accepts an optional `companyCode`.
Blank logs into the default company (preserving the seeded logins below); otherwise
the code must resolve to an `Active` company. The issued JWT carries a `companyId`
claim and `TenantResolutionMiddleware` resolves the tenant database for every
authenticated request. Suspended companies are blocked.

**Company admin activation** — the invited admin sets a password via
`GET /api/auth/activate?token=…` (validate) and `POST /api/auth/activate`
(set password and sign in). No plaintext password is ever emailed or stored.

**Email** — configure SMTP through `Email:*` (or environment variables such as
`Email__Host`, `Email__Password`). When `Email:Enabled` is `false` (the default in
development) the invitation is recorded and not sent; the activation link is
returned by the create/resend API so the Super Admin can share it manually.

## Database / migrations

```bash
# add a tenant migration
dotnet ef migrations add <Name> -p src/Hrms.Infrastructure -s src/Hrms.Api -o Persistence/Migrations

# add a master-registry migration
dotnet ef migrations add <Name> -c HrmsMasterDbContext -p src/Hrms.Infrastructure -s src/Hrms.Api -o Persistence/MasterMigrations

# update the database manually
dotnet ef database update -p src/Hrms.Infrastructure -s src/Hrms.Api

# reset (drop) the demo database
sqllocaldb stop MSSQLLocalDB
sqllocaldb delete MSSQLLocalDB
sqllocaldb create MSSQLLocalDB
```

Connection string and JWT settings live in `src/Hrms.Api/appsettings.json`.
**Change `Jwt:Key` and the seeded passwords before any real deployment.**

## CORS

The API allows `http://localhost:4200` and `https://localhost:4200` (see
`Cors:AllowedOrigins`). Add your deployed frontend origin there.

## Tests

```bash
dotnet test
```

`tests/Hrms.Tests` covers tenant naming/sanitisation (including SQL-injection
guards), provisioning idempotency and failure recovery, invitation activation
(single-use and expiry), company-code login resolution and tenant connection
routing.
