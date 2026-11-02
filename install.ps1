<#
  Luna MD installer for Windows.

  Downloads the latest Luna MD release from GitHub, checks it against the
  release's SHA256SUMS.txt, and installs it for your user account. No .exe
  installer to run, and no admin rights needed.

  Install or update (PowerShell):
    irm https://raw.githubusercontent.com/dortaedward/luna-md-desktop/main/install.ps1 | iex

  Options (run the downloaded script, or use the scriptblock form):
    .\install.ps1 -Version v0.1.0     install a specific release
    .\install.ps1 -Uninstall          remove the app (your notes are never touched)
    & ([scriptblock]::Create((irm <url-of-install.ps1>))) -Uninstall
#>
param(
  [string]$Version = "latest",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue" # makes downloads much faster in Windows PowerShell

# The GitHub repository releases come from ("owner/name")
$Repo = if ($env:LUNA_REPO) { $env:LUNA_REPO } else { "dortaedward/luna-md-desktop" }

$AppName     = "Luna MD"
$ExeName     = "luna-md-desktop.exe"
$InstallDir  = Join-Path $env:LOCALAPPDATA "Programs\Luna MD"
$Shortcut    = Join-Path ([Environment]::GetFolderPath("Programs")) "Luna MD.lnk"
$UninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\LunaMD"

function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Green }
function Info($text) { Write-Host "    $text" }
# Errors are thrown, not "exit": with "irm | iex", exit would close your PowerShell window
function Fail($text) { throw [System.Exception]::new("LUNA: $text") }

function Stop-Luna {
  Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($ExeName)) -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
}

function Invoke-LunaInstall {
  # ---------------------------------------------------------------------------
  # Uninstall
  # ---------------------------------------------------------------------------
  if ($Uninstall) {
    Step "Removing $AppName"
    Stop-Luna
    if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force; Info "Removed $InstallDir" }
    if (Test-Path $Shortcut) { Remove-Item $Shortcut -Force; Info "Removed the Start menu shortcut" }
    if (Test-Path $UninstallKey) { Remove-Item $UninstallKey -Recurse -Force }
    Write-Host ""
    Write-Host "Done. Your notes (Documents\LunaMD by default) and settings were not touched."
    return
  }

  # Windows PowerShell 5.1 may default to old TLS versions that GitHub refuses
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $Arch  = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64" -or $env:PROCESSOR_ARCHITEW6432 -eq "ARM64") { "arm64" } else { "x64" }
  $Asset = "Luna-MD-windows-$Arch.zip"
  if ($env:LUNA_DOWNLOAD_URL) {
    $BaseUrl = $env:LUNA_DOWNLOAD_URL
  } elseif ($Version -eq "latest") {
    $BaseUrl = "https://github.com/$Repo/releases/latest/download"
  } else {
    $BaseUrl = "https://github.com/$Repo/releases/download/$Version"
  }

  Write-Host "Luna MD installer"

  $Tmp = Join-Path ([IO.Path]::GetTempPath()) ("luna-md-" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $Tmp | Out-Null

  try {
    # -------------------------------------------------------------------------
    # 1. Download and check
    # -------------------------------------------------------------------------
    Step "Downloading $Asset ($Version release of $Repo)"
    $ZipPath = Join-Path $Tmp $Asset
    try {
      Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/$Asset" -OutFile $ZipPath
    } catch {
      Fail "Couldn't download $BaseUrl/$Asset. Is there a release with that file?"
    }
    try {
      $Sums = (Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/SHA256SUMS.txt").Content
      if ($Sums -is [byte[]]) { $Sums = [Text.Encoding]::UTF8.GetString($Sums) }
    } catch {
      Fail "Couldn't download the release's SHA256SUMS.txt, so the download can't be checked."
    }

    Step "Checking the download"
    $Expected = $null
    foreach ($line in ($Sums -split "`r?`n")) {
      $parts = $line.Trim() -split "\s+"
      if ($parts.Count -ge 2 -and $parts[1].TrimStart("*") -eq $Asset) { $Expected = $parts[0].ToLower() }
    }
    if (-not $Expected) { Fail "$Asset isn't listed in SHA256SUMS.txt." }
    $Actual = (Get-FileHash -Algorithm SHA256 -Path $ZipPath).Hash.ToLower()
    if ($Actual -ne $Expected) {
      Fail "Checksum mismatch: the download is damaged or not the real release. Nothing was installed."
    }
    Info "SHA-256 matches: $Actual"

    # -------------------------------------------------------------------------
    # 2. Install
    # -------------------------------------------------------------------------
    Step "Installing to $InstallDir"
    $Unzipped = Join-Path $Tmp "app"
    Expand-Archive -Path $ZipPath -DestinationPath $Unzipped -Force
    $Exe = Get-ChildItem -Path $Unzipped -Filter $ExeName -Recurse | Select-Object -First 1
    if (-not $Exe) { Fail "The download doesn't contain $ExeName." }

    Stop-Luna
    if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force }
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Copy-Item -Path (Join-Path $Exe.Directory.FullName "*") -Destination $InstallDir -Recurse -Force
    Get-ChildItem -Path $InstallDir -Recurse -File | Unblock-File # it came from GitHub via this script

    $ExePath = Join-Path $InstallDir $ExeName

    # Start menu shortcut
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut($Shortcut)
    $lnk.TargetPath = $ExePath
    $lnk.WorkingDirectory = $InstallDir
    $lnk.IconLocation = "$ExePath,0"
    $lnk.Description = "Markdown notes"
    $lnk.Save()
    Info "Added $AppName to the Start menu"

    # Uninstall from Settings → Apps: save this script's uninstall step next to the app
    $UninstallScript = Join-Path $InstallDir "uninstall.ps1"
    @"
Get-Process -Name '$([IO.Path]::GetFileNameWithoutExtension($ExeName))' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Remove-Item '$Shortcut' -Force -ErrorAction SilentlyContinue
Remove-Item '$UninstallKey' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item '$InstallDir' -Recurse -Force -ErrorAction SilentlyContinue
"@ | Set-Content -Path $UninstallScript -Encoding UTF8

    $InstalledVersion = (Get-Item $ExePath).VersionInfo.ProductVersion
    New-Item -Path $UninstallKey -Force | Out-Null
    $props = @{
      DisplayName     = $AppName
      DisplayVersion  = "$InstalledVersion"
      Publisher       = "Edward Dorta"
      DisplayIcon     = "$ExePath,0"
      InstallLocation = $InstallDir
      UninstallString = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$UninstallScript`""
      NoModify        = 1
      NoRepair        = 1
    }
    foreach ($k in $props.Keys) {
      $type = if ($props[$k] -is [int]) { "DWord" } else { "String" }
      New-ItemProperty -Path $UninstallKey -Name $k -Value $props[$k] -PropertyType $type -Force | Out-Null
    }

    Write-Host ""
    Write-Host "Luna MD is installed." -ForegroundColor Green
    Info "Open it from the Start menu."
    Info "Run this installer again any time to update. Remove it from Settings > Apps, or with -Uninstall."
  } finally {
    Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

try {
  Invoke-LunaInstall
} catch {
  $msg = $_.Exception.Message
  if ($msg.StartsWith("LUNA: ")) { $msg = $msg.Substring(6) }
  Write-Host ""
  Write-Host "Error: $msg" -ForegroundColor Red
}
