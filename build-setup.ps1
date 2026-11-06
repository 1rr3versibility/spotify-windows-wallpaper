param(
    [string]$WindowsMetadata
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$out = Join-Path $root 'out'
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$compiler = Join-Path $framework 'csc.exe'

if ($WindowsMetadata) { & (Join-Path $root 'build.ps1') -WindowsMetadata $WindowsMetadata } else { & (Join-Path $root 'build.ps1') }

$stage = Join-Path $out 'setup-stage'
if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item -LiteralPath (Join-Path $out 'TaliaPlayer.exe') -Destination $stage
Get-ChildItem -LiteralPath $out -Filter '*.dll' -File | Copy-Item -Destination $stage
Copy-Item -LiteralPath (Join-Path $root 'assets') -Destination (Join-Path $stage 'assets') -Recurse
foreach ($dev in @('assets\wallpaper\sheet.html', 'assets\wallpaper\sheet.js')) {
    $path = Join-Path $stage $dev
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
}
foreach ($file in @('README.txt', 'LICENSE-CAPRI.md', 'LICENSE-SPICETIFY.txt', 'lib\webview2\LICENSE-WebView2.txt')) {
    $path = Join-Path $root $file
    if (Test-Path -LiteralPath $path) { Copy-Item -LiteralPath $path -Destination $stage }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$appZip = Join-Path $out 'app.zip'
if (Test-Path -LiteralPath $appZip) { Remove-Item -LiteralPath $appZip -Force }
[IO.Compression.ZipFile]::CreateFromDirectory($stage, $appZip, [IO.Compression.CompressionLevel]::Optimal, $false)

$spicetifyZip = Join-Path $root 'lib\spicetify\spicetify-2.46.4-windows-x64.zip'
if (-not (Test-Path -LiteralPath $spicetifyZip)) { throw "Missing $spicetifyZip" }

$setup = Join-Path $out 'TaliaSetup.exe'
$options = @('/nologo', '/langversion:5', '/target:winexe', '/platform:anycpu', '/optimize+', '/utf8output', '/warn:4', "/out:$setup",
    ('/win32manifest:' + (Join-Path $root 'installer\setup.manifest')))
$icon = Join-Path $root 'assets\talia.ico'
if (Test-Path -LiteralPath $icon) { $options += '/win32icon:' + $icon }
$references = @('System.dll', 'System.Core.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll',
    (Join-Path $framework 'System.IO.Compression.dll'), (Join-Path $framework 'System.IO.Compression.FileSystem.dll')) | ForEach-Object { '/reference:' + $_ }
$resources = @("/resource:$appZip,Talia.App.zip", "/resource:$spicetifyZip,Talia.Spicetify.zip")
$sources = @((Join-Path $root 'installer\Setup.cs'), (Join-Path $root 'src\SpicetifyInstaller.cs'))
& $compiler ($options + $references + $resources + $sources)
if ($LASTEXITCODE -ne 0) { throw "TaliaSetup compilation failed with exit code $LASTEXITCODE." }
Remove-Item -LiteralPath $appZip -Force
Write-Output $setup
