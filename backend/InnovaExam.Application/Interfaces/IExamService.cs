using InnovaExam.Application.Common;
using InnovaExam.Application.DTOs.Exams;

namespace InnovaExam.Application.Interfaces;

public interface IExamService
{
    Task<ExamDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<PagedResult<ExamDto>> GetPagedAsync(ExamFilterRequest filter, PagedRequest paging, CancellationToken cancellationToken = default);
    Task<ExamDto> GenerateExamAsync(GenerateExamRequest request, Guid createdBy, CancellationToken cancellationToken = default);
    Task<bool> SendInviteAsync(Guid examId, CancellationToken cancellationToken = default);

    // Candidate-facing exam endpoints
    Task<ValidateTokenResponse> ValidateTokenAsync(string token, CancellationToken cancellationToken = default);
    Task<ExamSessionDto?> StartExamAsync(string token, string? ipAddress, string? userAgent, CancellationToken cancellationToken = default);
    Task<IEnumerable<ExamQuestionDto>> GetExamQuestionsAsync(Guid attemptId, CancellationToken cancellationToken = default);
    Task<bool> SubmitAnswerAsync(Guid attemptId, SubmitAnswerRequest request, CancellationToken cancellationToken = default);
    Task<bool> LogBehaviorAsync(Guid attemptId, BehaviorLogRequest request, CancellationToken cancellationToken = default);
    Task<bool> SubmitExamAsync(Guid attemptId, CancellationToken cancellationToken = default);
}
