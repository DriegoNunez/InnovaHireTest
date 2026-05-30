using InnovaExam.Domain.Enums;

namespace InnovaExam.Domain.Entities;

public class Question
{
    public Guid Id { get; set; }
    public Guid CategoryId { get; set; }
    public QuestionType QuestionType { get; set; }
    public DifficultyLevel DifficultyLevel { get; set; }
    public ExperienceLevel ExperienceLevel { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string? QuestionImageUrl { get; set; }
    public string? Explanation { get; set; }
    public int Points { get; set; }
    public int TimeLimitSeconds { get; set; }
    public QuestionStatus Status { get; set; } = QuestionStatus.Draft;
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public QuestionCategory Category { get; set; } = null!;
    public ICollection<QuestionOption> Options { get; set; } = new List<QuestionOption>();
    public ICollection<QuestionRubric> Rubrics { get; set; } = new List<QuestionRubric>();
    public ICollection<ExamQuestion> ExamQuestions { get; set; } = new List<ExamQuestion>();
}
