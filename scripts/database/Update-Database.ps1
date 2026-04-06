$ErrorActionPreference = "Stop"

$repoRoot = "C:\Users\Tajudeen.Onikoyi\Nikosoft\iBalance"
$startupProject = Join-Path $repoRoot "apps\api\iBalance.Api"
$project = Join-Path $repoRoot "src\BuildingBlocks\iBalance.BuildingBlocks.Infrastructure"

Push-Location $repoRoot

try {
    dotnet ef database update `
        --startup-project $startupProject `
        --project $project `
        --context ApplicationDbContext
}
finally {
    Pop-Location
}