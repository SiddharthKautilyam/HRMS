using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Hrms.Infrastructure.Persistence;

/// <summary>
/// Design-time factory used by `dotnet ef` so migrations can be created without
/// booting the API host.
/// </summary>
public sealed class HrmsDbContextFactory : IDesignTimeDbContextFactory<HrmsDbContext>
{
    private const string DesignTimeConnection =
        "Server=.\\SQLEXPRESS;Database=HRMS;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True";

    public HrmsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<HrmsDbContext>()
            .UseSqlServer(DesignTimeConnection)
            .Options;

        return new HrmsDbContext(options);
    }
}
