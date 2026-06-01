using InnovaExam.Application.Common;
using InnovaExam.Application.DTOs.Questions;
using InnovaExam.Application.Interfaces;
using InnovaExam.Domain.Entities;
using InnovaExam.Domain.Enums;
using InnovaExam.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InnovaExam.Infrastructure.Services;

public class QuestionService : IQuestionService
{
    private readonly InnovaExamDbContext _context;

    public QuestionService(InnovaExamDbContext context)
    {
        _context = context;
    }

    public async Task<QuestionDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var question = await _context.Questions
            .Include(q => q.Category)
            .Include(q => q.Options.OrderBy(o => o.DisplayOrder))
            .Include(q => q.Rubrics.OrderBy(r => r.DisplayOrder))
            .FirstOrDefaultAsync(q => q.Id == id, cancellationToken);

        if (question == null) return null;

        return MapToDto(question);
    }

    public async Task<PagedResult<QuestionDto>> GetPagedAsync(QuestionFilterRequest filter, PagedRequest paging, CancellationToken cancellationToken = default)
    {
        var query = _context.Questions
            .Include(q => q.Category)
            .Include(q => q.Options.OrderBy(o => o.DisplayOrder))
            .Include(q => q.Rubrics.OrderBy(r => r.DisplayOrder))
            .AsQueryable();

        if (filter.CategoryId.HasValue)
            query = query.Where(q => q.CategoryId == filter.CategoryId.Value);

        if (filter.QuestionType.HasValue)
            query = query.Where(q => q.QuestionType == filter.QuestionType.Value);

        if (filter.DifficultyLevel.HasValue)
            query = query.Where(q => q.DifficultyLevel == filter.DifficultyLevel.Value);

        if (filter.ExperienceLevel.HasValue)
            query = query.Where(q => q.ExperienceLevel == filter.ExperienceLevel.Value);

        if (filter.Status.HasValue)
            query = query.Where(q => q.Status == filter.Status.Value);

        if (!string.IsNullOrWhiteSpace(filter.SearchText))
            query = query.Where(q => q.QuestionText.Contains(filter.SearchText));

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(q => q.CreatedAt)
            .Skip((paging.Page - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<QuestionDto>
        {
            Items = items.Select(MapToDto),
            TotalCount = totalCount,
            Page = paging.Page,
            PageSize = paging.PageSize
        };
    }

    public async Task<QuestionDto> CreateAsync(CreateQuestionRequest request, Guid createdBy, CancellationToken cancellationToken = default)
    {
        var question = new Question
        {
            Id = Guid.NewGuid(),
            CategoryId = request.CategoryId,
            QuestionType = request.QuestionType,
            DifficultyLevel = request.DifficultyLevel,
            ExperienceLevel = request.ExperienceLevel,
            QuestionText = request.QuestionText,
            QuestionImageUrl = request.QuestionImageUrl,
            Explanation = request.Explanation,
            Points = request.Points,
            TimeLimitSeconds = request.TimeLimitSeconds,
            Status = request.Status,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
            Options = request.Options.Select(o => new QuestionOption
            {
                Id = Guid.NewGuid(),
                OptionText = o.OptionText,
                IsCorrect = o.IsCorrect,
                DisplayOrder = o.DisplayOrder
            }).ToList(),
            Rubrics = request.Rubrics.Select(r => new QuestionRubric
            {
                Id = Guid.NewGuid(),
                Criteria = r.Criteria,
                MaxPoints = r.MaxPoints,
                Description = r.Description,
                DisplayOrder = r.DisplayOrder
            }).ToList()
        };

        await _context.Questions.AddAsync(question, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        // Reload with category
        var created = await _context.Questions
            .Include(q => q.Category)
            .Include(q => q.Options)
            .Include(q => q.Rubrics)
            .FirstAsync(q => q.Id == question.Id, cancellationToken);

        return MapToDto(created);
    }

    public async Task<QuestionDto?> UpdateAsync(Guid id, UpdateQuestionRequest request, CancellationToken cancellationToken = default)
    {
        var question = await _context.Questions
            .Include(q => q.Options)
            .Include(q => q.Rubrics)
            .FirstOrDefaultAsync(q => q.Id == id, cancellationToken);

        if (question == null) return null;

        question.CategoryId = request.CategoryId;
        question.QuestionType = request.QuestionType;
        question.DifficultyLevel = request.DifficultyLevel;
        question.ExperienceLevel = request.ExperienceLevel;
        question.QuestionText = request.QuestionText;
        question.QuestionImageUrl = request.QuestionImageUrl;
        question.Explanation = request.Explanation;
        question.Points = request.Points;
        question.TimeLimitSeconds = request.TimeLimitSeconds;
        question.Status = request.Status;
        question.UpdatedAt = DateTime.UtcNow;

        var existingOptions = question.Options.ToList();
        var existingRubrics = question.Rubrics.ToList();

        _context.QuestionOptions.RemoveRange(existingOptions);
        _context.QuestionRubrics.RemoveRange(existingRubrics);

        var nextOptions = request.Options.Select(o => new QuestionOption
        {
            Id = Guid.NewGuid(),
            QuestionId = question.Id,
            OptionText = o.OptionText,
            IsCorrect = o.IsCorrect,
            DisplayOrder = o.DisplayOrder
        }).ToList();

        var nextRubrics = request.Rubrics.Select(r => new QuestionRubric
        {
            Id = Guid.NewGuid(),
            QuestionId = question.Id,
            Criteria = r.Criteria,
            MaxPoints = r.MaxPoints,
            Description = r.Description,
            DisplayOrder = r.DisplayOrder
        }).ToList();

        await _context.QuestionOptions.AddRangeAsync(nextOptions, cancellationToken);
        await _context.QuestionRubrics.AddRangeAsync(nextRubrics, cancellationToken);

        await _context.SaveChangesAsync(cancellationToken);

        var updated = await _context.Questions
            .Include(q => q.Category)
            .Include(q => q.Options)
            .Include(q => q.Rubrics)
            .FirstAsync(q => q.Id == question.Id, cancellationToken);

        return MapToDto(updated);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var question = await _context.Questions.FindAsync(new object[] { id }, cancellationToken);
        if (question == null) return false;

        _context.Questions.Remove(question);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IEnumerable<QuestionCategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken = default)
    {
        return await _context.QuestionCategories
            .Where(c => c.IsActive)
            .Select(c => new QuestionCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                IsActive = c.IsActive,
                QuestionCount = c.Questions.Count
            })
            .OrderBy(c => c.Name)
            .ToListAsync(cancellationToken);
    }

    private static QuestionDto MapToDto(Question q) => new()
    {
        Id = q.Id,
        CategoryId = q.CategoryId,
        CategoryName = q.Category?.Name ?? string.Empty,
        QuestionType = q.QuestionType,
        DifficultyLevel = q.DifficultyLevel,
        ExperienceLevel = q.ExperienceLevel,
        QuestionText = q.QuestionText,
        QuestionImageUrl = q.QuestionImageUrl,
        Explanation = q.Explanation,
        Points = q.Points,
        TimeLimitSeconds = q.TimeLimitSeconds,
        Status = q.Status,
        CreatedAt = q.CreatedAt,
        UpdatedAt = q.UpdatedAt,
        Options = q.Options.Select(o => new QuestionOptionDto
        {
            Id = o.Id,
            OptionText = o.OptionText,
            IsCorrect = o.IsCorrect,
            DisplayOrder = o.DisplayOrder
        }).ToList(),
        Rubrics = q.Rubrics.Select(r => new QuestionRubricDto
        {
            Id = r.Id,
            Criteria = r.Criteria,
            MaxPoints = r.MaxPoints,
            Description = r.Description,
            DisplayOrder = r.DisplayOrder
        }).ToList()
    };
}
