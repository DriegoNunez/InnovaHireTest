using InnovaExam.Application.Common;
using InnovaExam.Application.DTOs.Audit;
using InnovaExam.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InnovaExam.Api.Controllers;

[Route("api/admin/[controller]")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AuditController : ControllerBase
{
    private readonly IAuditService _auditService;

    public AuditController(IAuditService auditService)
    {
        _auditService = auditService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAuditLogs([FromQuery] AuditLogFilterRequest filter, [FromQuery] PagedRequest paging)
    {
        var logs = await _auditService.GetPagedAsync(filter, paging);
        return Ok(logs);
    }
}
