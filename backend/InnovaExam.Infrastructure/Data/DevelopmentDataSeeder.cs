using InnovaExam.Domain.Entities;
using InnovaExam.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace InnovaExam.Infrastructure.Data;

public static class DevelopmentDataSeeder
{
    public static async Task SeedAsync(InnovaExamDbContext context, IConfiguration configuration, CancellationToken cancellationToken = default)
    {
        await EnsureRolesAsync(context, cancellationToken);
        await EnsureAdminAsync(context, configuration, cancellationToken);
        await EnsureEntryLevelMultipleChoiceQuestionsAsync(context, cancellationToken);
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

    private static async Task EnsureEntryLevelMultipleChoiceQuestionsAsync(InnovaExamDbContext context, CancellationToken cancellationToken)
    {
        var adminUserId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var seedDate = new DateTime(2024, 1, 3, 0, 0, 0, DateTimeKind.Utc);

        var questionSeeds = new[]
        {
            new EntryQuestionSeed
            {
                Id = Guid.Parse("88888888-0001-0001-0001-000000000001"),
                CategoryId = Guid.Parse("44444444-0001-0001-0001-000000000001"),
                QuestionType = QuestionType.MultipleChoiceSingle,
                DifficultyLevel = DifficultyLevel.Level1,
                QuestionText = "Which structural element primarily carries vertical floor loads to the foundation?",
                Explanation = "Columns primarily transfer gravity loads from beams, slabs, and framing down to the foundation.",
                Points = 5,
                TimeLimitSeconds = 120,
                Options =
                [
                    ("Beam", false),
                    ("Column", true),
                    ("Expansion joint", false),
                    ("Vapor barrier", false)
                ]
            },
            new EntryQuestionSeed
            {
                Id = Guid.Parse("88888888-0001-0001-0001-000000000002"),
                CategoryId = Guid.Parse("44444444-0001-0001-0001-000000000002"),
                QuestionType = QuestionType.MultipleChoiceSingle,
                DifficultyLevel = DifficultyLevel.Level1,
                QuestionText = "In steel member notation, what does W12x26 most directly identify?",
                Explanation = "A W-shape designation gives the nominal depth and weight per foot, which identifies the rolled steel member size.",
                Points = 5,
                TimeLimitSeconds = 120,
                Options =
                [
                    ("A wide-flange beam approximately 12 in. deep weighing 26 lb/ft", true),
                    ("A weld that is 12 in. long with 26 passes", false),
                    ("A wall that is 12 ft high and 26 ft long", false),
                    ("A wood member with a 12 in. by 26 in. section", false)
                ]
            },
            new EntryQuestionSeed
            {
                Id = Guid.Parse("88888888-0001-0001-0001-000000000003"),
                CategoryId = Guid.Parse("44444444-0001-0001-0001-000000000003"),
                QuestionType = QuestionType.MultipleChoiceSingle,
                DifficultyLevel = DifficultyLevel.Level1,
                QuestionText = "What is the main purpose of reinforcing steel in a typical concrete beam?",
                Explanation = "Concrete is strong in compression but weak in tension; reinforcing steel is placed to resist tensile forces and control cracking.",
                Points = 5,
                TimeLimitSeconds = 120,
                Options =
                [
                    ("To resist tensile forces and control cracking", true),
                    ("To make the concrete cure faster", false),
                    ("To replace the need for formwork", false),
                    ("To reduce the beam self-weight to zero", false)
                ]
            },
            new EntryQuestionSeed
            {
                Id = Guid.Parse("88888888-0001-0001-0001-000000000004"),
                CategoryId = Guid.Parse("44444444-0001-0001-0001-000000000008"),
                QuestionType = QuestionType.MultipleChoiceMultiple,
                DifficultyLevel = DifficultyLevel.Level2,
                QuestionText = "Which items should an entry-level engineer commonly verify when reading a structural plan? Select all that apply.",
                Explanation = "Plan review should confirm gridlines, member tags, dimensions, elevations or levels, and referenced details before design or drafting decisions are made.",
                Points = 8,
                TimeLimitSeconds = 180,
                Options =
                [
                    ("Gridlines and dimensions", true),
                    ("Member tags or schedule references", true),
                    ("Detail callouts", true),
                    ("The contractor's payroll records", false)
                ]
            }
        };

        for (var seedIndex = 0; seedIndex < questionSeeds.Length; seedIndex++)
        {
            var seed = questionSeeds[seedIndex];

            if (await context.Questions.AnyAsync(q => q.Id == seed.Id, cancellationToken))
            {
                continue;
            }

            context.Questions.Add(new Question
            {
                Id = seed.Id,
                CategoryId = seed.CategoryId,
                QuestionType = seed.QuestionType,
                DifficultyLevel = seed.DifficultyLevel,
                ExperienceLevel = ExperienceLevel.EntryLevel,
                QuestionText = seed.QuestionText,
                Explanation = seed.Explanation,
                Points = seed.Points,
                TimeLimitSeconds = seed.TimeLimitSeconds,
                Status = QuestionStatus.Published,
                CreatedBy = adminUserId,
                CreatedAt = seedDate
            });

            context.QuestionOptions.AddRange(seed.Options.Select((option, index) => new QuestionOption
            {
                Id = Guid.Parse($"99999999-0001-0001-{seedIndex + 1:0000}-{index + 1:000000000000}"),
                QuestionId = seed.Id,
                OptionText = option.Text,
                IsCorrect = option.IsCorrect,
                DisplayOrder = index + 1,
                CreatedAt = seedDate
            }));
        }
    }

    private sealed class EntryQuestionSeed
    {
        public Guid Id { get; init; }
        public Guid CategoryId { get; init; }
        public QuestionType QuestionType { get; init; }
        public DifficultyLevel DifficultyLevel { get; init; }
        public string QuestionText { get; init; } = string.Empty;
        public string Explanation { get; init; } = string.Empty;
        public int Points { get; init; }
        public int TimeLimitSeconds { get; init; }
        public IReadOnlyList<(string Text, bool IsCorrect)> Options { get; init; } = [];
    }
}
