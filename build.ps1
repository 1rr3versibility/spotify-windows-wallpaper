param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot 'out'),
    [string]$WindowsMetadata
)

$ErrorActionPreference = 'Stop'
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$compiler = Join-Path $framework 'csc.exe'
$wpf = Join-Path $framework 'WPF'

if (-not (Test-Path -LiteralPath $compiler)) {
    throw 'The .NET Framework compiler was not found. This project needs Windows with .NET Framework 4.8 or 4.8.1.'
}
if (-not $WindowsMetadata) {
    $localMetadata = Join-Path $PSScriptRoot '..\capri-build\Windows.winmd'
    if (Test-Path -LiteralPath $localMetadata) { $WindowsMetadata = $localMetadata }
}
if (-not $WindowsMetadata) {
    $sdkMetadata = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\UnionMetadata'
    $WindowsMetadata = Get-ChildItem -LiteralPath $sdkMetadata -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^\d+(\.\d+)+$' } |
        Sort-Object { [version]$_.Name } -Descending |
        ForEach-Object { Join-Path $_.FullName 'Windows.winmd' } |
        Where-Object { Test-Path -LiteralPath $_ } |
        Select-Object -First 1
}
if (-not $WindowsMetadata -or -not (Test-Path -LiteralPath $WindowsMetadata -PathType Leaf)) {
    throw 'The merged Windows.winmd reference was not found. Install the Windows SDK or pass -WindowsMetadata with the path to Windows.winmd.'
}
$WindowsMetadata = (Resolve-Path -LiteralPath $WindowsMetadata).Path

$output = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -Path $output -ItemType Directory -Force | Out-Null
$exe = Join-Path $output 'TaliaPlayer.exe'
$sources = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'src') -Filter '*.cs' -File -Recurse | ForEach-Object { $_.FullName })
$references = @(
    'System.dll', 'System.Core.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll',
    'System.Runtime.Serialization.dll', 'System.Web.Extensions.dll', 'System.Security.dll',
    (Join-Path $PSScriptRoot 'lib\webview2\Microsoft.Web.WebView2.Core.dll'),
    (Join-Path $PSScriptRoot 'lib\webview2\Microsoft.Web.WebView2.WinForms.dll'),
    (Join-Path $wpf 'UIAutomationClient.dll'),
    (Join-Path $wpf 'UIAutomationTypes.dll'),
    (Join-Path $wpf 'WindowsBase.dll'),
    (Join-Path $framework 'System.Runtime.dll'),
    (Join-Path $framework 'System.Runtime.WindowsRuntime.dll'),
    (Join-Path $framework 'System.Runtime.InteropServices.WindowsRuntime.dll'),
    $WindowsMetadata
) | ForEach-Object { '/reference:' + $_ }

$resources = @()
$assetDirectory = Join-Path $PSScriptRoot 'assets'
$upstreamAssets = Join-Path $PSScriptRoot 'assets\upstream'
if (-not (Test-Path -LiteralPath $upstreamAssets)) {
    $upstreamAssets = Join-Path $PSScriptRoot '..\capri-adapted\assets'
}
foreach ($resource in @(@('fonts\ShareTechMono-Regular.ttf', 'Capri.Font.Mono.ttf'), @('cursor.png', 'Capri.Cursor.png'))) {
    $file = Join-Path $upstreamAssets $resource[0]
    if (Test-Path -LiteralPath $file -PathType Leaf) {
        $resources += '/resource:' + (Resolve-Path -LiteralPath $file).Path + ',' + $resource[1]
    }
}

$options = @('/nologo', '/langversion:5', '/target:winexe', '/platform:anycpu', '/optimize+', '/utf8output', '/warn:4', "/out:$exe")
$icon = Join-Path $assetDirectory 'talia.ico'
if (Test-Path -LiteralPath $icon) { $options += '/win32icon:' + (Resolve-Path -LiteralPath $icon).Path }
& $compiler ($options + $references + $resources + $sources)
if ($LASTEXITCODE -ne 0) { throw "TaliaPlayer compilation failed with exit code $LASTEXITCODE." }
foreach ($library in Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'lib\webview2') -Filter '*.dll' -File) {
    Copy-Item -LiteralPath $library.FullName -Destination $output -Force
}
if ($output.TrimEnd('\') -ne $PSScriptRoot.TrimEnd('\')) {
    Copy-Item -LiteralPath $assetDirectory -Destination $output -Recurse -Force
}
Write-Output $exe
