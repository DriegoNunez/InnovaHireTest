namespace InnovaExam.Domain.Entities;

public class QuestionRubric
{
    public Guid Id { get; set; }
    public Guid QuestionId { get; set; }
    public string Criteria { get; set; } = string.Empty;
    public int MaxPoints { get; set; }
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Question Question { get; set; } = null!;
}
