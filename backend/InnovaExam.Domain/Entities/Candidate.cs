using InnovaExam.Domain.Enums;

namespace InnovaExam.Domain.Entities;

public class Candidate
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public ExperienceLevel ExperienceLevel { get; set; }
    public int? YearsOfExperience { get; set; }
    public string? CurrentCompany { get; set; }
    public string? ResumeUrl { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public ICollection<Exam> Exams { get; set; } = new List<Exam>();
}
