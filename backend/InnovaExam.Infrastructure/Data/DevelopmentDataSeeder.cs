using InnovaExam.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace InnovaExam.Infrastructure.Data;

public static class DevelopmentDataSeeder
{
    public static async Task SeedAsync(InnovaExamDbContext context, IConfiguration configuration, CancellationToken cancellationToken = default)
    {
        await EnsureRolesAsync(context, cancellationToken);
        await EnsureAdminAsync(context, configuration, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureRolesAsync(InnovaExamDbContext context, CancellationToken cancellationToken)
    {
        var roles = new[]
        {
            (Guid.Parse("11111111-1111-1111-1111-111111111111"), "Admin", "System administrator with full access"),
            (Guid.Parse("22222222-2222-2222-2222-222222222222"), "HR", "Human Resources personnel managing candidates and exams"),
            (Guid.Parse("33333333-3333-3333-3333-333333333333"), "Candidate", "Exam candidate")
        };

        foreach (var roleSeed in roles)
        {
            var role = await context.Roles.FirstOrDefaultAsync(r => r.Name == roleSeed.Item2, cancellationToken);
            if (role == null)
            {
                context.Roles.Add(new Role
                {
                    Id = roleSeed.Item1,
                    Name = roleSeed.Item2,
                    Description = roleSeed.Item3,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }
    }

    private static async Task EnsureAdminAsync(InnovaExamDbContext context, IConfiguration configuration, CancellationToken cancellationToken)
    {
        var adminRole = await context.Roles.FirstAsync(r => r.Name == "Admin", cancellationToken);
        var adminUserId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var configuredPassword = configuration["SeedAdmin:Password"];
        var admin = await context.Users
            .Include(u => u.UserRoles)
            .FirstOrDefaultAsync(u => u.Email == "admin@innovanv.com", cancellationToken);

        if (admin == null)
        {
            admin = new User
            {
                Id = adminUserId,
                Email = "admin@innovanv.com",
                FirstName = "System",
                LastName = "Administrator",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(configuredPassword ?? Guid.NewGuid().ToString("N")),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            context.Users.Add(admin);
        }

        if (!string.IsNullOrWhiteSpace(configuredPassword))
        {
            admin.PasswordHash = BCrypt.Net.BCrypt.HashPassword(configuredPassword);
        }

        admin.IsActive = true;

        if (!admin.UserRoles.Any(ur => ur.RoleId == adminRole.Id))
        {
            admin.UserRoles.Add(new UserRole
            {
                UserId = admin.Id,
                RoleId = adminRole.Id,
                AssignedAt = DateTime.UtcNow
            });
        }
    }
}
