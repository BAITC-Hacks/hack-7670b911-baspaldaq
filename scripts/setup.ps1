param(
  [switch]$Seed
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot

try {
  if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
    Write-Host 'Created .env from .env.example. Add OPENAI_API_KEY locally before using AI.'
  }

  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }

  npm run prisma:generate
  if ($LASTEXITCODE -ne 0) { throw 'Prisma Client generation failed' }

  npm run prisma:deploy
  if ($LASTEXITCODE -ne 0) { throw 'Database migrations failed' }

  if ($Seed) {
    npm run db:seed
    if ($LASTEXITCODE -ne 0) { throw 'Demo seed failed' }
  }

  Write-Host 'Setup complete. Run npm run dev to start the client and API.'
} finally {
  Pop-Location
}
