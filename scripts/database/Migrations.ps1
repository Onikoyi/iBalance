param(
    [Parameter(Mandatory = $false)]
    [string]$MigrationName = "InitialPlatformSchema"
)

$solutionRoot = "C:\Users\Tajudeen.Onikoyi\Nikosoft\iBalance"
$project = "C:\Users\Tajudeen.Onikoyi\Nikosoft\iBalance\src\BuildingBlocks\iBalance.BuildingBlocks.Infrastructure\iBalance.BuildingBlocks.Infrastructure.csproj"
$startupProject = "C:\Users\Tajudeen.Onikoyi\Nikosoft\iBalance\apps\api\iBalance.Api\iBalance.Api.csproj"
$dbContext = "iBalance.BuildingBlocks.Infrastructure.Persistence.ApplicationDbContext"
$outputDir = "Persistence\Migrations"

Write-Host "Restoring local .NET tools..." -ForegroundColor Cyan
Set-Location $solutionRoot
dotnet tool restore

if ($LASTEXITCODE -ne 0) {
    throw "dotnet tool restore failed."
}

Write-Host "Creating EF Core migration: $MigrationName" -ForegroundColor Cyan

dotnet tool run dotnet-ef migrations add $MigrationName `
  --project $project `
  --startup-project $startupProject `
  --context $dbContext `
  --output-dir $outputDir

if ($LASTEXITCODE -ne 0) {
    throw "Migration creation failed."
}

Write-Host "Migration created successfully." -ForegroundColor Green