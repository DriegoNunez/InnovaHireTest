using InnovaExam.Domain.Enums;

namespace InnovaExam.Application.DTOs.Candidates;

public class CandidateDto
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
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateCandidateRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public ExperienceLevel ExperienceLevel { get; set; }
    public int? YearsOfExperience { get; set; }
    public string? CurrentCompany { get; set; }
    public string? ResumeUrl { get; set; }
    public string? Notes { get; set; }
}

public class UpdateCandidateRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public ExperienceLevel ExperienceLevel { get; set; }
    public int? YearsOfExperience { get; set; }
    public string? CurrentCompany { get; set; }
    public string? ResumeUrl { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
}

public class CandidateFilterRequest
{
    public string? SearchText { get; set; }
    public ExperienceLevel? ExperienceLevel { get; set; }
    public bool? IsActive { get; set; }
}
