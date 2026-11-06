using Hrms.Application.Abstractions.Security;
using Hrms.Domain.Entities;
using Hrms.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Hrms.Api.Startup;

public static class SeedAdminCli
{
    public static async Task<int> ExecuteAsync(string[] args, IServiceProvider services)
    {
        string? email = null;
        string? password = null;
        string name = "Platform Administrator";

        for (int i = 0; i < args.Length; i++)
        {
            if (args[i].Equals("--email", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
            {
                email = args[++i];
            }
            else if (args[i].Equals("--password", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
            {
                password = args[++i];
            }
            else if (args[i].Equals("--name", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
            {
                name = args[++i];
            }
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            Console.WriteLine("Error: --email <email> is required for seed-admin.");
            return 1;
        }

        if (!string.IsNullOrWhiteSpace(password))
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("[SECURITY WARNING] Passing passwords via --password stores plaintext credentials in your shell history. We strongly recommend omitting --password to use the masked interactive prompt instead.");
            Console.ResetColor();
        }
        else
        {
            Console.Write($"Enter password for Super Admin ({email}): ");
            password = ReadMaskedPassword();
            Console.WriteLine();

            Console.Write("Confirm password: ");
            var confirm = ReadMaskedPassword();
            Console.WriteLine();

            if (string.IsNullOrEmpty(password) || password != confirm)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Error: Passwords did not match or were empty.");
                Console.ResetColor();
                return 1;
            }
        }

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrmsDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var superAdminRole = await db.Roles.FirstOrDefaultAsync(r => r.Code == "SuperAdmin");
        if (superAdminRole == null)
        {
            superAdminRole = new Role
            {
                Code = "SuperAdmin",
                Name = "Super Admin",
                Description = "System-wide Administrator",
                IsSystem = true
            };
            db.Roles.Add(superAdminRole);
            await db.SaveChangesAsync();
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
        if (user == null)
        {
            user = new User
            {
                Email = normalizedEmail,
                FullName = name.Trim(),
                Initials = "SA",
                RoleId = superAdminRole.Id,
                PasswordHash = hasher.Hash(password),
                IsActive = true
            };
            db.Users.Add(user);
            Console.WriteLine($"Super Admin user '{normalizedEmail}' created successfully.");
        }
        else
        {
            user.RoleId = superAdminRole.Id;
            user.PasswordHash = hasher.Hash(password);
            user.IsActive = true;
            db.Users.Update(user);
            Console.WriteLine($"Existing user '{normalizedEmail}' promoted/updated to Super Admin with new password.");
        }

        await db.SaveChangesAsync();
        return 0;
    }

    private static string ReadMaskedPassword()
    {
        var pwd = new System.Text.StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter)
            {
                break;
            }
            if (key.Key == ConsoleKey.Backspace)
            {
                if (pwd.Length > 0)
                {
                    pwd.Remove(pwd.Length - 1, 1);
                    Console.Write("\b \b");
                }
            }
            else if (!char.IsControl(key.KeyChar))
            {
                pwd.Append(key.KeyChar);
                Console.Write("*");
            }
        }
        return pwd.ToString();
    }
}
