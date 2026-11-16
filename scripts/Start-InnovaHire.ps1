# Start-InnovaHire.ps1
#
# Downloads (or updates) INNOVA Hire next to this script and runs it at http://localhost:3000.
# Save this file in the folder where you want the app (e.g. D:\InnovaAI\Hiring Exam),
# then right-click it and choose "Run with PowerShell".
#
# Requires Node.js 22+ (https://nodejs.org) and Git (https://git-scm.com/download/win).

# npm and git print progress to stderr; rely on exit codes instead of stopping on it.
$ErrorActionPreference = "Continue"
$Repo = "https://github.com/DriegoNunez/InnovaHireTest.git"
$Port = 3000

function Stop-WithError([string]$Message) {
    Write-Host ""
    Write-Host $Message -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

# If the script is already inside the repository (scripts\), use that checkout.
$ScriptDir = $PSScriptRoot
if (Test-Path (Join-Path (Split-Path $ScriptDir -Parent) "package.json")) {
    $App = Split-Path $ScriptDir -Parent
} else {
    $App = Join-Path $ScriptDir "InnovaHireTest"
}

# --- Prerequisites ------------------------------------------------------------
Step "Checking prerequisites"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Stop-WithError "Node.js is not installed. Install the LTS version from https://nodejs.org, then run this script again."
}
$nodeVersion = (node -v).Trim()
$nodeMajor = [int]($nodeVersion.TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 22) {
    Stop-WithError "Node.js 22 or newer is required (found $nodeVersion). Install the LTS version from https://nodejs.org."
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Stop-WithError "Git is not installed. Install it from https://git-scm.com/download/win, then run this script again."
}
Write-Host "Node $nodeVersion, $(git --version)"

$listening = $null
if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
    $listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
}
if ($listening) {
    Write-Host "Something is already running on port $Port (probably INNOVA Hire). Opening it." -ForegroundColor Yellow
    Write-Host "To restart, close the other PowerShell window running the app and run this script again."
    Start-Process "http://localhost:$Port"
    Read-Host "Press Enter to close"
    exit 0
}

# --- Code -----------------------------------------------------------------------
if (Test-Path (Join-Path $App ".git")) {
    Step "Updating code in $App"
    git -C "$App" pull --ff-only
    if ($LASTEXITCODE -ne 0) { Stop-WithError "Could not update the code. If you edited files in $App, undo those changes and try again." }
} elseif (Test-Path $App) {
    Stop-WithError "$App exists but is not a Git clone. Rename or delete that folder and run this script again."
} else {
    Step "Downloading code to $App"
    git clone $Repo "$App"
    if ($LASTEXITCODE -ne 0) { Stop-WithError "Could not download the code from GitHub. Check your internet connection and GitHub access." }
}
Set-Location -LiteralPath $App

# --- Configuration --------------------------------------------------------------
$EnvFile = Join-Path $App ".env"
if (-not (Test-Path $EnvFile)) {
    Step "Creating .env"
    Copy-Item (Join-Path $App ".env.example") $EnvFile
}
# The production server needs a signing secret; generate one if it is missing.
$envLines = [string[]](Get-Content $EnvFile)
if (-not ($envLines | Where-Object { $_ -match "^AUTH_SECRET=.{32,}" })) {
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes)
    $envLines = @($envLines | Where-Object { $_ -notmatch "^AUTH_SECRET=" }) + "AUTH_SECRET=$secret"
    # UTF-8 without BOM so Node reads the file correctly.
    [System.IO.File]::WriteAllLines($EnvFile, [string[]]$envLines)
}

function Read-EnvValue([string]$Name) {
    $line = Get-Content $EnvFile | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
    if ($line) { return $line.Substring($Name.Length + 1).Trim('"') }
    return ""
}

# --- Install, database, build ---------------------------------------------------
Step "Installing dependencies (first run takes a few minutes)"
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Stop-WithError "npm install failed. See the messages above." }

Step "Preparing the database"
npm run db:seed
if ($LASTEXITCODE -ne 0) { Stop-WithError "Database setup failed. See the messages above." }

Step "Building the app"
npm run build
if ($LASTEXITCODE -ne 0) { Stop-WithError "The build failed. See the messages above." }

# --- Run ------------------------------------------------------------------------
$email = Read-EnvValue "SEED_ADMIN_EMAIL"
$password = Read-EnvValue "SEED_ADMIN_PASSWORD"
Write-Host ""
Write-Host "INNOVA Hire is starting at http://localhost:$Port" -ForegroundColor Green
Write-Host "Sign in with: $email / $password"
Write-Host "Keep this window open while you use the app. Press Ctrl+C to stop it."
Write-Host ""

# Open the browser once the server answers.
Start-Job -ArgumentList $Port -ScriptBlock {
    param($p)
    for ($i = 0; $i -lt 120; $i++) {
        try {
            Invoke-WebRequest "http://localhost:$p/login" -UseBasicParsing -TimeoutSec 2 | Out-Null
            Start-Process "http://localhost:$p"
            break
        } catch { Start-Sleep -Seconds 1 }
    }
} | Out-Null

$env:PORT = "$Port"
npm start
