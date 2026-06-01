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
    private readonly IWebHostEnvironment _environment;

    public QuestionsController(IQuestionService questionService, IWebHostEnvironment environment)
    {
        _questionService = questionService;
        _environment = environment;
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

    [HttpPost("images")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> UploadQuestionImage(IFormFile image)
    {
        if (image == null || image.Length == 0)
            return BadRequest(new { message = "Choose an image to upload." });

        if (image.Length > 5 * 1024 * 1024)
            return BadRequest(new { message = "Image uploads are limited to 5 MB." });

        var allowedContentTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/gif"] = ".gif",
            ["image/webp"] = ".webp"
        };

        if (!allowedContentTypes.TryGetValue(image.ContentType, out var extension))
            return BadRequest(new { message = "Upload a JPG, PNG, GIF, or WebP image." });

        var webRootPath = _environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot");
        var uploadPath = Path.Combine(webRootPath, "uploads", "questions");
        Directory.CreateDirectory(uploadPath);

        var fileName = $"{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(uploadPath, fileName);

        await using (var stream = System.IO.File.Create(filePath))
        {
            await image.CopyToAsync(stream);
        }

        return Ok(new { imageUrl = $"/uploads/questions/{fileName}" });
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
