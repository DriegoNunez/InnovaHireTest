using InnovaExam.Application.DTOs.Questions;
using InnovaExam.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InnovaExam.Api.Controllers;

[Route("api/admin/[controller]")]
[ApiController]
[Authorize(Roles = "Admin")]
public class QuestionsController : ControllerBase
{
    private readonly IQuestionService _questionService;

    public QuestionsController(IQuestionService questionService)
    {
        _questionService = questionService;
    }

    [HttpGet]
    public async Task<IActionResult> GetQuestions([FromQuery] QuestionFilterRequest filter, [FromQuery] InnovaExam.Application.Common.PagedRequest paging)
    {
        var questions = await _questionService.GetPagedAsync(filter, paging);
        return Ok(questions);
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _questionService.GetCategoriesAsync();
        return Ok(categories);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetQuestion(Guid id)
    {
        var question = await _questionService.GetByIdAsync(id);
        if (question == null)
            return NotFound();

        return Ok(question);
    }

    [HttpPost]
    public async Task<IActionResult> CreateQuestion([FromBody] CreateQuestionRequest dto)
    {
        // Dummy user id for now
        var result = await _questionService.CreateAsync(dto, Guid.Empty);
        return CreatedAtAction(nameof(GetQuestion), new { id = result.Id }, result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateQuestion(Guid id, [FromBody] UpdateQuestionRequest dto)
    {
        var result = await _questionService.UpdateAsync(id, dto);
        if (result == null)
            return NotFound();

        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteQuestion(Guid id)
    {
        var deleted = await _questionService.DeleteAsync(id);
        if (!deleted)
            return NotFound();

        return NoContent();
    }
}
