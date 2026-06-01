using InnovaExam.Application.DTOs.Exams;
using InnovaExam.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InnovaExam.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ExamController : ControllerBase
{
    private readonly IExamService _examService;
    private readonly IWebHostEnvironment _environment;

    public ExamController(IExamService examService, IWebHostEnvironment environment)
    {
        _examService = examService;
        _environment = environment;
    }

    [HttpGet("validate/{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> ValidateToken(string token)
    {
        var result = await _examService.ValidateTokenAsync(token);
        return Ok(result);
    }

    [HttpPost("{token}/start")]
    [AllowAnonymous]
    public async Task<IActionResult> StartExam(string token)
    {
        var session = await _examService.StartExamAsync(
            token,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString());

        if (session == null)
            return NotFound();

        return Ok(session);
    }

    [HttpGet("attempts/{attemptId}/questions")]
    [AllowAnonymous]
    public async Task<IActionResult> GetQuestions(Guid attemptId)
    {
        var questions = await _examService.GetExamQuestionsAsync(attemptId);
        return Ok(questions);
    }

    [HttpPost("attempts/{attemptId}/answers")]
    [AllowAnonymous]
    public async Task<IActionResult> SubmitAnswer(Guid attemptId, [FromBody] SubmitAnswerRequest request)
    {
        var saved = await _examService.SubmitAnswerAsync(attemptId, request);
        if (!saved)
            return NotFound();

        return NoContent();
    }

    [HttpPost("attempts/{attemptId}/answers/upload")]
    [AllowAnonymous]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> UploadAnswerFile(Guid attemptId, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Choose an image or PDF file." });

        if (file.Length > 10 * 1024 * 1024)
            return BadRequest(new { message = "The solution file must be 10 MB or smaller." });

        var allowedTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/gif"] = ".gif",
            ["image/webp"] = ".webp",
            ["application/pdf"] = ".pdf"
        };

        if (!allowedTypes.TryGetValue(file.ContentType, out var extension))
            return BadRequest(new { message = "Only JPG, PNG, GIF, WebP, or PDF files are allowed." });

        var questions = await _examService.GetExamQuestionsAsync(attemptId);
        if (!questions.Any())
            return NotFound();

        var uploadRoot = Path.Combine(_environment.ContentRootPath, "wwwroot", "uploads", "answers");
        Directory.CreateDirectory(uploadRoot);

        var safeOriginalName = Path.GetFileName(file.FileName);
        var fileName = $"{attemptId:N}-{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(uploadRoot, fileName);

        await using (var stream = System.IO.File.Create(filePath))
        {
            await file.CopyToAsync(stream);
        }

        return Ok(new
        {
            fileUrl = $"/uploads/answers/{fileName}",
            fileName = safeOriginalName
        });
    }

    [HttpPost("attempts/{attemptId}/submit")]
    [AllowAnonymous]
    public async Task<IActionResult> SubmitExam(Guid attemptId)
    {
        var submitted = await _examService.SubmitExamAsync(attemptId);
        if (!submitted)
            return NotFound();

        return NoContent();
    }
}
