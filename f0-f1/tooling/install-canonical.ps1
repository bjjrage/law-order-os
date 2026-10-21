$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskRoot = (Get-Location).Path
$packageRoot = Join-Path $taskRoot 'LAW_ORDER_OS_BLUEPRINT_ROADMAP_CANONICO_V2'
$archive = [IO.Compression.ZipFile]::OpenRead((Join-Path $taskRoot 'LAW_ORDER_OS_BLUEPRINT_ROADMAP_CANONICO_V2.zip'))
$rows = @()
try {
  foreach ($entry in $archive.Entries) {
    if ($entry.FullName.EndsWith('/')) { continue }
    if ($entry.FullName -match '(^/|^[A-Za-z]:|(^|/)\.\.(/|$)|\\)' -or $entry.Length -gt 2097152) { throw 'Unexpected ZIP entry' }
    $stream = $entry.Open()
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $zipHash = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $sha.Dispose() }
    $source = Join-Path $packageRoot $entry.FullName
    $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($zipHash -ne $sourceHash) { throw "ZIP/extracted mismatch: $($entry.FullName)" }
    $installed = $false
    if ($entry.FullName.StartsWith('docs/')) {
      $destination = [IO.Path]::GetFullPath((Join-Path $taskRoot $entry.FullName))
      if (-not $destination.StartsWith(($taskRoot + [IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase)) { throw 'Path outside workspace' }
      if (Test-Path -LiteralPath $destination) { throw "Refusing overwrite: $destination" }
      [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
      [IO.File]::Copy($source,$destination,$false)
      $installed = $true
    }
    $rows += [pscustomobject]@{path=$entry.FullName; sha256=$zipHash; zip_matches_extracted=$true; installed=$installed}
  }
} finally { $archive.Dispose() }
$html = 'C:/Users/User/Downloads/LAW_ORDER_OS_BLUEPRINT_v2.0(3).html'
$result = [pscustomobject]@{date='2026-10-13'; files=$rows; user_html_sha256=(Get-FileHash -LiteralPath $html -Algorithm SHA256).Hash.ToLowerInvariant(); canonical_html_sha256=(Get-FileHash -LiteralPath 'docs/LAW_ORDER_OS_BLUEPRINT_v2.0.html' -Algorithm SHA256).Hash.ToLowerInvariant()}
$result | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 'f0-f1/reports/canonical-installation.json'
$result | ConvertTo-Json -Depth 5
