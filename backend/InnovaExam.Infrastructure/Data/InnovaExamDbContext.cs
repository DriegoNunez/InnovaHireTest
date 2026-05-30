using InnovaExam.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace InnovaExam.Infrastructure.Data;

public class InnovaExamDbContext : DbContext
{
    public InnovaExamDbContext(DbContextOptions<InnovaExamDbContext> options)
        : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<QuestionOption> QuestionOptions => Set<QuestionOption>();
    public DbSet<QuestionCategory> QuestionCategories => Set<QuestionCategory>();
    public DbSet<QuestionRubric> QuestionRubrics => Set<QuestionRubric>();
    public DbSet<Candidate> Candidates => Set<Candidate>();
    public DbSet<Exam> Exams => Set<Exam>();
    public DbSet<ExamQuestion> ExamQuestions => Set<ExamQuestion>();
    public DbSet<ExamAttempt> ExamAttempts => Set<ExamAttempt>();
    public DbSet<CandidateAnswer> CandidateAnswers => Set<CandidateAnswer>();
    public DbSet<GradingResult> GradingResults => Set<GradingResult>();
    public DbSet<BehaviorLog> BehaviorLogs => Set<BehaviorLog>();
    public DbSet<AIMisuseReview> AIMisuseReviews => Set<AIMisuseReview>();
    public DbSet<FinalReport> FinalReports => Set<FinalReport>();
    public DbSet<EmailLog> EmailLogs => Set<EmailLog>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ===================== USER =====================
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.Email).HasMaxLength(256).IsRequired();
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.PasswordHash).HasMaxLength(512).IsRequired();
            entity.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.LastName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.RefreshToken).HasMaxLength(512);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        });

        // ===================== ROLE =====================
        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("Roles");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.Name).HasMaxLength(50).IsRequired();
            entity.HasIndex(e => e.Name).IsUnique();
            entity.Property(e => e.Description).HasMaxLength(256);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        });

        // ===================== USER ROLE =====================
        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.ToTable("UserRoles");
            entity.HasKey(e => new { e.UserId, e.RoleId });
            entity.Property(e => e.AssignedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.User)
                .WithMany(u => u.UserRoles)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Role)
                .WithMany(r => r.UserRoles)
                .HasForeignKey(e => e.RoleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ===================== QUESTION CATEGORY =====================
        modelBuilder.Entity<QuestionCategory>(entity =>
        {
            entity.ToTable("QuestionCategories");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.HasIndex(e => e.Name).IsUnique();
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        });

        // ===================== QUESTION =====================
        modelBuilder.Entity<Question>(entity =>
        {
            entity.ToTable("Questions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.QuestionType).HasConversion<int>();
            entity.Property(e => e.DifficultyLevel).HasConversion<int>();
            entity.Property(e => e.ExperienceLevel).HasConversion<int>();
            entity.Property(e => e.QuestionText).IsRequired();
            entity.Property(e => e.QuestionImageUrl).HasMaxLength(1000);
            entity.Property(e => e.Status).HasConversion<int>().HasDefaultValue(Domain.Enums.QuestionStatus.Draft);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Category)
                .WithMany(c => c.Questions)
                .HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ===================== QUESTION OPTION =====================
        modelBuilder.Entity<QuestionOption>(entity =>
        {
            entity.ToTable("QuestionOptions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.OptionText).HasMaxLength(2000).IsRequired();
            entity.Property(e => e.IsCorrect).HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Question)
                .WithMany(q => q.Options)
                .HasForeignKey(e => e.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ===================== QUESTION RUBRIC =====================
        modelBuilder.Entity<QuestionRubric>(entity =>
        {
            entity.ToTable("QuestionRubrics");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.Criteria).HasMaxLength(500).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Question)
                .WithMany(q => q.Rubrics)
                .HasForeignKey(e => e.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ===================== CANDIDATE =====================
        modelBuilder.Entity<Candidate>(entity =>
        {
            entity.ToTable("Candidates");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.LastName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Email).HasMaxLength(256).IsRequired();
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Phone).HasMaxLength(20);
            entity.Property(e => e.ExperienceLevel).HasConversion<int>();
            entity.Property(e => e.CurrentCompany).HasMaxLength(200);
            entity.Property(e => e.ResumeUrl).HasMaxLength(1000);
            entity.Property(e => e.Notes).HasMaxLength(2000);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        });

        // ===================== EXAM =====================
        modelBuilder.Entity<Exam>(entity =>
        {
            entity.ToTable("Exams");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.Title).HasMaxLength(500).IsRequired();
            entity.Property(e => e.ExperienceLevel).HasConversion<int>();
            entity.Property(e => e.AccessToken).HasMaxLength(512);
            entity.HasIndex(e => e.AccessToken).IsUnique().HasFilter("[AccessToken] IS NOT NULL");
            entity.Property(e => e.InvitationUrl).HasMaxLength(1000);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Candidate)
                .WithMany(c => c.Exams)
                .HasForeignKey(e => e.CandidateId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ===================== EXAM QUESTION =====================
        modelBuilder.Entity<ExamQuestion>(entity =>
        {
            entity.ToTable("ExamQuestions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");

            entity.HasOne(e => e.Exam)
                .WithMany(ex => ex.ExamQuestions)
                .HasForeignKey(e => e.ExamId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Question)
                .WithMany(q => q.ExamQuestions)
                .HasForeignKey(e => e.QuestionId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.ExamId, e.QuestionId }).IsUnique();
        });

        // ===================== EXAM ATTEMPT =====================
        modelBuilder.Entity<ExamAttempt>(entity =>
        {
            entity.ToTable("ExamAttempts");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.Status).HasConversion<int>().HasDefaultValue(Domain.Enums.ExamAttemptStatus.Pending);
            entity.Property(e => e.PercentageScore).HasColumnType("decimal(5,2)");
            entity.Property(e => e.IpAddress).HasMaxLength(50);
            entity.Property(e => e.UserAgent).HasMaxLength(512);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Exam)
                .WithMany(ex => ex.ExamAttempts)
                .HasForeignKey(e => e.ExamId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ===================== CANDIDATE ANSWER =====================
        modelBuilder.Entity<CandidateAnswer>(entity =>
        {
            entity.ToTable("CandidateAnswers");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.SelectedOptionIds).HasMaxLength(2000);
            entity.Property(e => e.IsMarkedForReview).HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.ExamAttempt)
                .WithMany(ea => ea.CandidateAnswers)
                .HasForeignKey(e => e.ExamAttemptId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.ExamQuestion)
                .WithMany()
                .HasForeignKey(e => e.ExamQuestionId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.ExamAttemptId, e.ExamQuestionId }).IsUnique();
        });

        // ===================== GRADING RESULT =====================
        modelBuilder.Entity<GradingResult>(entity =>
        {
            entity.ToTable("GradingResults");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.RubricScores).HasMaxLength(4000);
            entity.Property(e => e.ConfidenceScore).HasColumnType("decimal(5,4)");
            entity.Property(e => e.IsAutoGraded).HasDefaultValue(true);
            entity.Property(e => e.OverrideReason).HasMaxLength(1000);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.ExamAttempt)
                .WithMany(ea => ea.GradingResults)
                .HasForeignKey(e => e.ExamAttemptId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.CandidateAnswer)
                .WithMany()
                .HasForeignKey(e => e.CandidateAnswerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ===================== BEHAVIOR LOG =====================
        modelBuilder.Entity<BehaviorLog>(entity =>
        {
            entity.ToTable("BehaviorLogs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.EventType).HasMaxLength(100).IsRequired();
            entity.Property(e => e.EventData).HasMaxLength(4000);
            entity.Property(e => e.RiskLevel).HasConversion<int>();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.ExamAttempt)
                .WithMany(ea => ea.BehaviorLogs)
                .HasForeignKey(e => e.ExamAttemptId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.ExamAttemptId);
        });

        // ===================== AI MISUSE REVIEW =====================
        modelBuilder.Entity<AIMisuseReview>(entity =>
        {
            entity.ToTable("AIMisuseReviews");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.RiskLevel).HasConversion<int>();
            entity.Property(e => e.ConfidenceScore).HasColumnType("decimal(5,4)");
            entity.Property(e => e.Indicators).HasMaxLength(4000);
            entity.Property(e => e.ReviewNotes).HasMaxLength(2000);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.ExamAttempt)
                .WithMany(ea => ea.AIMisuseReviews)
                .HasForeignKey(e => e.ExamAttemptId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.CandidateAnswer)
                .WithMany()
                .HasForeignKey(e => e.CandidateAnswerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ===================== FINAL REPORT =====================
        modelBuilder.Entity<FinalReport>(entity =>
        {
            entity.ToTable("FinalReports");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.PercentageScore).HasColumnType("decimal(5,2)");
            entity.Property(e => e.HiringRecommendation).HasConversion<int>();
            entity.Property(e => e.IntegrityRiskLevel).HasConversion<int>();
            entity.Property(e => e.StrengthAreas).HasMaxLength(4000);
            entity.Property(e => e.WeaknessAreas).HasMaxLength(4000);
            entity.Property(e => e.CategoryScores).HasMaxLength(4000);
            entity.Property(e => e.ReportPdfUrl).HasMaxLength(1000);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.ExamAttempt)
                .WithOne(ea => ea.FinalReport)
                .HasForeignKey<FinalReport>(e => e.ExamAttemptId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ===================== EMAIL LOG =====================
        modelBuilder.Entity<EmailLog>(entity =>
        {
            entity.ToTable("EmailLogs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.EmailType).HasConversion<int>();
            entity.Property(e => e.RecipientEmail).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Subject).HasMaxLength(500).IsRequired();
            entity.Property(e => e.Status).HasConversion<int>().HasDefaultValue(Domain.Enums.EmailStatus.Queued);
            entity.Property(e => e.ErrorMessage).HasMaxLength(2000);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Exam)
                .WithMany(ex => ex.EmailLogs)
                .HasForeignKey(e => e.ExamId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ===================== AUDIT LOG =====================
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("AuditLogs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            entity.Property(e => e.Action).HasMaxLength(200).IsRequired();
            entity.Property(e => e.EntityType).HasMaxLength(100).IsRequired();
            entity.Property(e => e.EntityId).HasMaxLength(100);
            entity.Property(e => e.IpAddress).HasMaxLength(50);
            entity.Property(e => e.UserAgent).HasMaxLength(512);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.User)
                .WithMany(u => u.AuditLogs)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.EntityType);
        });

        // ===================== SEED DATA =====================
        SeedData(modelBuilder);
    }

    private static void SeedData(ModelBuilder modelBuilder)
    {
        // Seed Roles
        var adminRoleId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var hrRoleId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var candidateRoleId = Guid.Parse("33333333-3333-3333-3333-333333333333");

        modelBuilder.Entity<Role>().HasData(
            new Role { Id = adminRoleId, Name = "Admin", Description = "System administrator with full access" },
            new Role { Id = hrRoleId, Name = "HR", Description = "Human Resources personnel managing candidates and exams" },
            new Role { Id = candidateRoleId, Name = "Candidate", Description = "Exam candidate" }
        );

        var adminUserId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

        // Seed Question Categories
        var categories = new[]
        {
            ("44444444-0001-0001-0001-000000000001", "Structural Engineering Fundamentals"),
            ("44444444-0001-0001-0001-000000000002", "Steel Design"),
            ("44444444-0001-0001-0001-000000000003", "Concrete Design"),
            ("44444444-0001-0001-0001-000000000004", "ASCE 7 Loading"),
            ("44444444-0001-0001-0001-000000000005", "IBC Code Knowledge"),
            ("44444444-0001-0001-0001-000000000006", "Structural Analysis"),
            ("44444444-0001-0001-0001-000000000007", "Engineering Judgment"),
            ("44444444-0001-0001-0001-000000000008", "Drawing Interpretation"),
            ("44444444-0001-0001-0001-000000000009", "Construction Documents"),
            ("44444444-0001-0001-0001-00000000000a", "QA/QC"),
            ("44444444-0001-0001-0001-00000000000b", "Technical Communication")
        };

        modelBuilder.Entity<QuestionCategory>().HasData(
            categories.Select(c => new QuestionCategory
            {
                Id = Guid.Parse(c.Item1),
                Name = c.Item2,
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }).ToArray()
        );

        // Seed structural engineering questions for the Phase 2 admin question bank demo.
        var seedDate = new DateTime(2024, 1, 2, 0, 0, 0, DateTimeKind.Utc);
        var q1 = Guid.Parse("55555555-0001-0001-0001-000000000001");
        var q2 = Guid.Parse("55555555-0001-0001-0001-000000000002");
        var q3 = Guid.Parse("55555555-0001-0001-0001-000000000003");
        var q4 = Guid.Parse("55555555-0001-0001-0001-000000000004");
        var q5 = Guid.Parse("55555555-0001-0001-0001-000000000005");

        modelBuilder.Entity<Question>().HasData(
            new Question
            {
                Id = q1,
                CategoryId = Guid.Parse("44444444-0001-0001-0001-000000000004"),
                QuestionType = Domain.Enums.QuestionType.MultipleChoiceSingle,
                DifficultyLevel = Domain.Enums.DifficultyLevel.Level2,
                ExperienceLevel = Domain.Enums.ExperienceLevel.EntryLevel,
                QuestionText = "For a low-rise office building, which ASCE 7 load type is most directly associated with lateral force resisting system design?",
                Explanation = "Wind and seismic loads govern lateral force resisting system design; this question focuses on the ASCE 7 lateral load family.",
                Points = 8,
                TimeLimitSeconds = 180,
                Status = Domain.Enums.QuestionStatus.Published,
                CreatedBy = adminUserId,
                CreatedAt = seedDate
            },
            new Question
            {
                Id = q2,
                CategoryId = Guid.Parse("44444444-0001-0001-0001-000000000002"),
                QuestionType = Domain.Enums.QuestionType.CalculationProblem,
                DifficultyLevel = Domain.Enums.DifficultyLevel.Level3,
                ExperienceLevel = Domain.Enums.ExperienceLevel.PE,
                QuestionText = "A simply supported W-shape beam spans 24 ft and carries a uniform service dead load of 0.65 kip/ft plus live load of 1.20 kip/ft. Describe the LRFD factored moment check you would perform before selecting the beam.",
                Explanation = "The candidate should form the governing LRFD load combination, calculate maximum moment for uniform load, then compare required flexural strength to available design strength.",
                Points = 15,
                TimeLimitSeconds = 600,
                Status = Domain.Enums.QuestionStatus.Published,
                CreatedBy = adminUserId,
                CreatedAt = seedDate
            },
            new Question
            {
                Id = q3,
                CategoryId = Guid.Parse("44444444-0001-0001-0001-000000000003"),
                QuestionType = Domain.Enums.QuestionType.StructuralDesign,
                DifficultyLevel = Domain.Enums.DifficultyLevel.Level4,
                ExperienceLevel = Domain.Enums.ExperienceLevel.PE,
                QuestionText = "Design approach prompt: outline the checks you would perform for a reinforced concrete shear wall boundary element in a high seismic demand region.",
                Explanation = "A complete answer should connect code triggers, axial-flexural demand, confinement detailing, shear strength, and constructability coordination.",
                Points = 25,
                TimeLimitSeconds = 900,
                Status = Domain.Enums.QuestionStatus.Published,
                CreatedBy = adminUserId,
                CreatedAt = seedDate
            },
            new Question
            {
                Id = q4,
                CategoryId = Guid.Parse("44444444-0001-0001-0001-000000000005"),
                QuestionType = Domain.Enums.QuestionType.CodeInterpretation,
                DifficultyLevel = Domain.Enums.DifficultyLevel.Level3,
                ExperienceLevel = Domain.Enums.ExperienceLevel.SeniorEngineer,
                QuestionText = "When reviewing an IBC code summary for an existing building addition, what coordination items should be verified before finalizing structural design criteria?",
                Explanation = "Senior candidates should identify occupancy, risk category, construction type, existing lateral system assumptions, special inspection scope, and governing adopted code amendments.",
                Points = 20,
                TimeLimitSeconds = 720,
                Status = Domain.Enums.QuestionStatus.Published,
                CreatedBy = adminUserId,
                CreatedAt = seedDate
            },
            new Question
            {
                Id = q5,
                CategoryId = Guid.Parse("44444444-0001-0001-0001-000000000008"),
                QuestionType = Domain.Enums.QuestionType.DrawingInterpretation,
                DifficultyLevel = Domain.Enums.DifficultyLevel.Level2,
                ExperienceLevel = Domain.Enums.ExperienceLevel.EntryLevel,
                QuestionText = "On a structural framing plan, what does a beam tag typically need to communicate to prevent ambiguity during detailing and construction?",
                Explanation = "Beam tags usually identify member size, elevation or camber where needed, end reactions or connection notes when required, and references to details or schedules.",
                Points = 10,
                TimeLimitSeconds = 240,
                Status = Domain.Enums.QuestionStatus.Published,
                CreatedBy = adminUserId,
                CreatedAt = seedDate
            }
        );

        modelBuilder.Entity<QuestionOption>().HasData(
            new QuestionOption { Id = Guid.Parse("66666666-0001-0001-0001-000000000001"), QuestionId = q1, OptionText = "Floor live load", IsCorrect = false, DisplayOrder = 1, CreatedAt = seedDate },
            new QuestionOption { Id = Guid.Parse("66666666-0001-0001-0001-000000000002"), QuestionId = q1, OptionText = "Roof snow load", IsCorrect = false, DisplayOrder = 2, CreatedAt = seedDate },
            new QuestionOption { Id = Guid.Parse("66666666-0001-0001-0001-000000000003"), QuestionId = q1, OptionText = "Wind or seismic load", IsCorrect = true, DisplayOrder = 3, CreatedAt = seedDate },
            new QuestionOption { Id = Guid.Parse("66666666-0001-0001-0001-000000000004"), QuestionId = q1, OptionText = "Partition allowance", IsCorrect = false, DisplayOrder = 4, CreatedAt = seedDate }
        );

        modelBuilder.Entity<QuestionRubric>().HasData(
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000001"), QuestionId = q2, Criteria = "Load combination", MaxPoints = 4, Description = "Correctly applies the governing LRFD gravity combination and distinguishes service from factored load.", DisplayOrder = 1, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000002"), QuestionId = q2, Criteria = "Moment demand", MaxPoints = 4, Description = "Computes maximum uniform-load moment using appropriate span units and support assumptions.", DisplayOrder = 2, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000003"), QuestionId = q2, Criteria = "Capacity comparison", MaxPoints = 4, Description = "Compares required strength to available flexural design strength and notes compactness or bracing considerations.", DisplayOrder = 3, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000004"), QuestionId = q2, Criteria = "Engineering communication", MaxPoints = 3, Description = "Explains assumptions clearly enough for review by a senior engineer.", DisplayOrder = 4, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000005"), QuestionId = q3, Criteria = "Code triggers", MaxPoints = 5, Description = "Identifies boundary element trigger checks and seismic detailing provisions.", DisplayOrder = 1, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000006"), QuestionId = q3, Criteria = "Strength checks", MaxPoints = 6, Description = "Addresses axial-flexural interaction, shear demand, and load combinations.", DisplayOrder = 2, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000007"), QuestionId = q3, Criteria = "Detailing", MaxPoints = 6, Description = "Covers confinement, development, lap splice limits, and constructability of reinforcement.", DisplayOrder = 3, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000008"), QuestionId = q3, Criteria = "Coordination judgment", MaxPoints = 4, Description = "Notes architectural, geotechnical, and special inspection coordination risks.", DisplayOrder = 4, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000009"), QuestionId = q3, Criteria = "Technical clarity", MaxPoints = 4, Description = "Presents a reviewable design workflow with defensible assumptions.", DisplayOrder = 5, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000010"), QuestionId = q4, Criteria = "Code criteria", MaxPoints = 6, Description = "Verifies occupancy, risk category, adopted code, amendments, and existing building provisions.", DisplayOrder = 1, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000011"), QuestionId = q4, Criteria = "Structural assumptions", MaxPoints = 6, Description = "Checks existing lateral system assumptions, gravity path, materials, and available records.", DisplayOrder = 2, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000012"), QuestionId = q4, Criteria = "Coordination", MaxPoints = 5, Description = "Identifies design team, jurisdiction, and special inspection coordination items.", DisplayOrder = 3, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000013"), QuestionId = q4, Criteria = "Risk framing", MaxPoints = 3, Description = "Flags uncertainty and recommends verification steps before final criteria are issued.", DisplayOrder = 4, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000014"), QuestionId = q5, Criteria = "Member identity", MaxPoints = 3, Description = "Explains that the tag must identify the beam or member size unambiguously.", DisplayOrder = 1, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000015"), QuestionId = q5, Criteria = "Detail references", MaxPoints = 3, Description = "Mentions details, schedules, connection notes, or reactions where needed.", DisplayOrder = 2, CreatedAt = seedDate },
            new QuestionRubric { Id = Guid.Parse("77777777-0001-0001-0001-000000000016"), QuestionId = q5, Criteria = "Constructability", MaxPoints = 4, Description = "Recognizes elevation, camber, slope, or coordination notes that reduce field ambiguity.", DisplayOrder = 3, CreatedAt = seedDate }
        );
    }
}
