using InnovaExam.Application.DTOs.Auth;

namespace InnovaExam.Application.Interfaces;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<LoginResponse?> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task<bool> LogoutAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<UserInfo?> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
