using InnovaExam.Domain.Enums;

namespace InnovaExam.Domain.Entities;

public class BehaviorLog
{
    public Guid Id { get; set; }
    public Guid ExamAttemptId { get; set; }
    public string EventType { get; set; } = string.Empty; // e.g., "TabSwitch", "CopyPaste", "RightClick", "FocusLost"
    public string? EventData { get; set; } // JSON object with event details
    public RiskLevel RiskLevel { get; set; } = RiskLevel.Low;
    public DateTime EventTimestamp { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ExamAttempt ExamAttempt { get; set; } = null!;
}
