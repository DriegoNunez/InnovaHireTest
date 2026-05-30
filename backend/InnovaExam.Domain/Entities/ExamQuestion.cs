namespace InnovaExam.Domain.Entities;

public class ExamQuestion
{
    public Guid Id { get; set; }
    public Guid ExamId { get; set; }
    public Guid QuestionId { get; set; }
    public int DisplayOrder { get; set; }
    public int Points { get; set; }

    // Navigation properties
    public Exam Exam { get; set; } = null!;
    public Question Question { get; set; } = null!;
}
