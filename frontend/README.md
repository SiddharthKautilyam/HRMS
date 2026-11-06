# Hrms

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.3.

## Multi-tenant portals

The single Angular app serves three isolated areas, all backed by the .NET API:

- **Super Admin** — gains a **Platform → Companies** area (`/companies`) to create and
  manage tenant companies, their provisioning status and admin invitations. Each new
  company provisions its own dedicated database.
- **Company Admin** — a company-scoped role that manages only its own company; it never
  sees the Companies area (guarded by `superAdminGuard` and enforced server-side).
- **Login** — the sign-in screen has an optional **Company Code** field. Leave it blank for
  the default company; a company admin enters their code to connect to their database.
- **Activation** — invited admins open `/activate?token=…` to set a password.

Tenant isolation is enforced by the API (per-request tenant database resolution), not by
the frontend.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
