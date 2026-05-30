using InnovaExam.Domain.Enums;

namespace InnovaExam.Domain.Entities;

public class EmailLog
{
    public Guid Id { get; set; }
    public Guid ExamId { get; set; }
    public EmailType EmailType { get; set; }
    public string RecipientEmail { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string? Body { get; set; }
    public EmailStatus Status { get; set; } = EmailStatus.Queued;
    public string? ErrorMessage { get; set; }
    public int RetryCount { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Exam Exam { get; set; } = null!;
}
