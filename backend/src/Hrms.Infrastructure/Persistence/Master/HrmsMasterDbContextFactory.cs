using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Hrms.Infrastructure.Persistence.Master;

/// <summary>
/// Design-time factory used by `dotnet ef` so master-database migrations can be created
/// without booting the API host.
/// </summary>
public sealed class HrmsMasterDbContextFactory : IDesignTimeDbContextFactory<HrmsMasterDbContext>
{
    private const string DesignTimeConnection =
        "Server=.\\SQLEXPRESS;Database=HRMS_Master;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True";

    public HrmsMasterDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<HrmsMasterDbContext>()
            .UseSqlServer(DesignTimeConnection)
            .Options;

        return new HrmsMasterDbContext(options);
    }
}
