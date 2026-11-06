using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Tenancy;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Application.Services;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;
using Hrms.Infrastructure.Persistence.Master;
using Hrms.Infrastructure.Persistence.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Hrms.Tests;

public sealed class CompanyProvisioningTests
{
    [Fact]
    public async Task CreateCompany_ProvisionsDedicatedDatabase_AndRetryIsIdempotent()
    {
        var (_, uow) = NewMaster();
        var tenant = new FakeTenantDatabaseService();
        var email = new FakeEmailSender();
        var service = NewService(uow, tenant, email, new FakePasswordHasher());

        var result = await service.CreateAsync(
            new CreateCompanyRequest("Acme Widgets", null, "Acme Admin", "Admin@Acme.test", null, null, null));

        Assert.Equal("Active", result.Status);
        Assert.True(result.DatabaseReady);
        Assert.True(result.AdminCreated);
        Assert.Equal("Sent", result.InvitationStatus);
        Assert.False(string.IsNullOrWhiteSpace(result.ActivationUrl));
        Assert.StartsWith("hrms_t_", result.DatabaseName);
        Assert.Single(tenant.Databases);
        Assert.Single(tenant.Users);
        Assert.Single(email.Sent);

        var databaseName = result.DatabaseName;

        // A retry must not create a second database, admin, invitation or company.
        var retry = await service.RetryProvisioningAsync(result.CompanyId);

        Assert.Equal("Active", retry.Status);
        Assert.Equal(databaseName, retry.DatabaseName);
        Assert.Single(tenant.Databases);
        Assert.Single(tenant.Users);
        Assert.Single(await uow.Invitations.ListAsync());
        Assert.Single(await uow.Companies.ListAsync(null));
    }

    [Fact]
    public async Task ProvisioningFailure_MarksCompanyFailed_AndRetryRecovers()
    {
        var (_, uow) = NewMaster();
        var tenant = new FakeTenantDatabaseService { ThrowOnProvision = true };
        var service = NewService(uow, tenant, new FakeEmailSender(), new FakePasswordHasher());

        var failed = await service.CreateAsync(
            new CreateCompanyRequest("Broken Co", null, "Admin", "admin@broken.test", null, null, null));

        Assert.Equal("Failed", failed.Status);
        Assert.False(failed.DatabaseReady);
        Assert.NotNull(failed.Error);

        var company = await uow.Companies.GetByIdAsync(failed.CompanyId);
        Assert.NotNull(company);
        Assert.Equal(CompanyStatus.Failed, company!.Status);
        Assert.Contains(await uow.ProvisioningLogs.ListAsync(), log => !log.Succeeded);

        tenant.ThrowOnProvision = false;
        var recovered = await service.RetryProvisioningAsync(failed.CompanyId);

        Assert.Equal("Active", recovered.Status);
        Assert.True(recovered.DatabaseReady);
        Assert.True(recovered.AdminCreated);
    }

    [Fact]
    public async Task CreateCompany_RejectsDuplicateCode()
    {
        var (_, uow) = NewMaster();
        var service = NewService(uow, new FakeTenantDatabaseService(), new FakeEmailSender(), new FakePasswordHasher());

        await service.CreateAsync(new CreateCompanyRequest("Acme", "SHARED", "A", "a@acme.test", null, null, null));

        await Assert.ThrowsAsync<ConflictException>(() =>
            service.CreateAsync(new CreateCompanyRequest("Acme Two", "SHARED", "B", "b@acme.test", null, null, null)));
    }

    [Fact]
    public async Task Activation_SetsPassword_AndCannotBeReused()
    {
        var (_, uow) = NewMaster();
        var tenant = new FakeTenantDatabaseService();
        var hasher = new FakePasswordHasher();
        var service = NewService(uow, tenant, new FakeEmailSender(), hasher);

        var created = await service.CreateAsync(
            new CreateCompanyRequest("Acme", null, "Acme Admin", "admin@acme.test", null, null, null));
        var token = QueryValue(created.ActivationUrl!, "token");

        var activation = new AccountActivationService(uow, tenant, hasher, new FakeJwtTokenService());

        var info = await activation.ValidateAsync(token);
        Assert.True(info.Valid);
        Assert.Equal("Acme", info.CompanyName);

        var login = await activation.ActivateAsync(new ActivateAccountRequest(token, "Secret@123"));
        Assert.Equal("CompanyAdmin", login.User.RoleCode);
        Assert.Equal("ACME", login.User.CompanyCode);

        var user = await tenant.FindUserByEmailAsync(created.DatabaseName!, "admin@acme.test");
        Assert.NotNull(user);
        Assert.True(hasher.Verify("Secret@123", user!.PasswordHash));

        // A consumed invitation cannot be used again.
        await Assert.ThrowsAsync<ValidationException>(() =>
            activation.ActivateAsync(new ActivateAccountRequest(token, "Other@123")));
        Assert.False((await activation.ValidateAsync(token)).Valid);
    }

    [Fact]
    public async Task Activation_ExpiredToken_IsRejected()
    {
        var (_, uow) = NewMaster();
        var tenant = new FakeTenantDatabaseService();
        var hasher = new FakePasswordHasher();
        var service = NewService(uow, tenant, new FakeEmailSender(), hasher);

        var created = await service.CreateAsync(
            new CreateCompanyRequest("Acme", null, "Acme Admin", "admin@acme.test", null, null, null));
        var token = QueryValue(created.ActivationUrl!, "token");

        var invitation = await uow.Invitations.GetLatestForCompanyAsync(created.CompanyId);
        Assert.NotNull(invitation);
        invitation!.ExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
        uow.Invitations.Update(invitation);
        await uow.SaveChangesAsync();

        var activation = new AccountActivationService(uow, tenant, hasher, new FakeJwtTokenService());

        Assert.False((await activation.ValidateAsync(token)).Valid);
        await Assert.ThrowsAsync<ValidationException>(() =>
            activation.ActivateAsync(new ActivateAccountRequest(token, "Secret@123")));
    }

    [Fact]
    public async Task Login_ResolvesDefaultTenant_AndTenantByCode()
    {
        var (_, uow) = NewMaster();
        var tenant = new FakeTenantDatabaseService();
        var hasher = new FakePasswordHasher();
        var auth = await BuildAuth(uow, tenant, hasher);

        var defaultLogin = await auth.LoginAsync(new LoginRequest("admin@hrnexus.com", "Admin@123"));
        Assert.Equal("HRNEXUS", defaultLogin.User.CompanyCode);

        var acmeLogin = await auth.LoginAsync(new LoginRequest("admin@acme.test", "Acme@123", "acme"));
        Assert.Equal("ACME", acmeLogin.User.CompanyCode);

        // When company code is omitted, admin email resolves to ACME tenant automatically
        var emailResolvedLogin = await auth.LoginAsync(new LoginRequest("admin@acme.test", "Acme@123"));
        Assert.Equal("ACME", emailResolvedLogin.User.CompanyCode);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            auth.LoginAsync(new LoginRequest("admin@acme.test", "Acme@123", "NOPE")));

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            auth.LoginAsync(new LoginRequest("admin@acme.test", "wrong", "ACME")));
    }

    [Fact]
    public async Task Login_BlocksSuspendedCompany()
    {
        var (_, uow) = NewMaster();
        var tenant = new FakeTenantDatabaseService();
        var hasher = new FakePasswordHasher();
        var auth = await BuildAuth(uow, tenant, hasher, suspendAcme: true);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            auth.LoginAsync(new LoginRequest("admin@acme.test", "Acme@123", "ACME")));
    }

    [Fact]
    public void ConnectionResolver_RoutesToResolvedTenant_AndFallsBackToDefault()
    {
        var context = new StubTenantContext();
        var resolver = new TenantConnectionResolver(context, new FakeTenantConnectionFactory());

        Assert.Equal("default", resolver.GetConnectionString());

        context.Set(new ResolvedTenant(Guid.NewGuid(), "ACME", "Acme", "hrms_t_acme", CompanyStatus.Active, false));
        Assert.Equal("tenant:hrms_t_acme", resolver.GetConnectionString());
    }

    // ── helpers ──

    private static (HrmsMasterDbContext Db, MasterUnitOfWork Uow) NewMaster()
    {
        var db = new HrmsMasterDbContext(new DbContextOptionsBuilder<HrmsMasterDbContext>()
            .UseInMemoryDatabase("master-" + Guid.NewGuid())
            .Options);

        return (db, new MasterUnitOfWork(db));
    }

    private static CompanyManagementService NewService(
        MasterUnitOfWork uow,
        FakeTenantDatabaseService tenant,
        FakeEmailSender email,
        FakePasswordHasher hasher) =>
        new(
            uow,
            tenant,
            hasher,
            email,
            Options.Create(new AppOptions { FrontendBaseUrl = "http://localhost:4200", InvitationExpiryHours = 72 }),
            NullLogger<CompanyManagementService>.Instance);

    private static async Task<AuthService> BuildAuth(
        IMasterUnitOfWork uow,
        FakeTenantDatabaseService tenant,
        FakePasswordHasher hasher,
        bool suspendAcme = false)
    {
        var defaultCompany = new Company
        {
            Name = "HRNexus Corp",
            Code = "HRNEXUS",
            DatabaseName = "HRMS",
            IsDefault = true,
            AdminFullName = "Alex Johnson",
            AdminEmail = "admin@hrnexus.com",
            Status = CompanyStatus.Active,
        };
        var acme = new Company
        {
            Name = "Acme",
            Code = "ACME",
            DatabaseName = "hrms_t_acme",
            AdminFullName = "Acme Admin",
            AdminEmail = "admin@acme.test",
            Status = suspendAcme ? CompanyStatus.Suspended : CompanyStatus.Active,
        };

        await uow.Companies.AddAsync(defaultCompany);
        await uow.Companies.AddAsync(acme);
        await uow.SaveChangesAsync();

        tenant.SeedUser("HRMS", "admin@hrnexus.com", hasher.Hash("Admin@123"), "Super Admin", "SuperAdmin");
        tenant.SeedUser("hrms_t_acme", "admin@acme.test", hasher.Hash("Acme@123"));

        // IUnitOfWork is only used by the authenticated flows, not by LoginAsync.
        return new AuthService(null!, tenant, new TenantResolutionService(uow), new StubTenantContext(), hasher, new FakeJwtTokenService());
    }

    private static string QueryValue(string url, string key)
    {
        var query = new Uri(url).Query.TrimStart('?');
        foreach (var pair in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            if (parts.Length == 2 && parts[0] == key)
            {
                return Uri.UnescapeDataString(parts[1]);
            }
        }

        throw new InvalidOperationException($"'{key}' was not found in '{url}'.");
    }
}
