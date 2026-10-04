# 城院 DSH 本机引导（Windows 10+，PowerShell）
# 每位师生本机运行 DSH Web（127.0.0.1:3080），仅共用局域网目录站下载安装器/技能。
# CHENGYUAN_CATALOG_URL 可覆盖目录站；启动 DSH 时也需保留该环境变量。
# 用法（在仓库或已拷贝的 packaging 目录）：
#   powershell -ExecutionPolicy Bypass -File .\install-dsh-windows.ps1
# 环境变量：
#   $env:CHENGYUAN_CATALOG_URL = "http://127.0.0.1:8080"
#   $env:INSTALL_INSTALLER = "0"   # 跳过安装器

$ErrorActionPreference = "Stop"

$DshVersion = if ($env:DSH_VERSION) { $env:DSH_VERSION } else { "0.1.5-rc.2" }
$CatalogUrl = if ($env:CHENGYUAN_CATALOG_URL) { $env:CHENGYUAN_CATALOG_URL.TrimEnd("/") } else { "http://127.0.0.1:8080" }
$InstallerTgz = "chengyuan-skill-installer-0.1.0.tgz"
$InstallInstaller = if ($env:INSTALL_INSTALLER) { $env:INSTALL_INSTALLER } else { "1" }
$BinDir = if ($env:CHENGYUAN_BIN_DIR) { $env:CHENGYUAN_BIN_DIR } else { Join-Path $env:USERPROFILE ".local\bin" }

Write-Host "[chengyuan-dsh] Node 检查…"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "未找到 node。请先安装 Node.js 18+（建议 20+）：https://nodejs.org/"
}
$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]").Trim())
if ($nodeMajor -lt 18) {
  Write-Error "需要 Node.js >= 18，当前: $(node -v)"
}
Write-Host "[chengyuan-dsh] node $(node -v)"

Write-Host "[chengyuan-dsh] 预取 @deepseek-ai/dsh@$DshVersion…"
npx --yes "@deepseek-ai/dsh@$DshVersion" --version | Out-Null

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$StartCmd = Join-Path $BinDir "chengyuan-dsh-web.cmd"
@"
@echo off
npx --yes @deepseek-ai/dsh@$DshVersion web %*
"@ | Set-Content -Encoding ASCII -Path $StartCmd
Write-Host "[chengyuan-dsh] 启动脚本: $StartCmd"

$exampleSrc = Join-Path $PSScriptRoot "templates\model-config.env.example"
$dshHome = Join-Path $env:USERPROFILE ".dsh"
New-Item -ItemType Directory -Force -Path $dshHome | Out-Null
$exampleDst = Join-Path $dshHome "chengyuan-model.env.example"
if ((Test-Path $exampleSrc) -and -not (Test-Path $exampleDst)) {
  Copy-Item $exampleSrc $exampleDst
  Write-Host "[chengyuan-dsh] 已复制模型配置模板 -> $exampleDst"
}

if ($InstallInstaller -eq "1") {
  Write-Host "[chengyuan-dsh] 安装城院 Skill 安装器（来自 $CatalogUrl）…"
  $tmp = Join-Path $env:TEMP $InstallerTgz
  try {
    Invoke-WebRequest -Uri "$CatalogUrl/plugins/$InstallerTgz" -OutFile $tmp -UseBasicParsing
    npx --yes "@deepseek-ai/dsh@$DshVersion" plugin --profile web add $tmp
    Write-Host "[chengyuan-dsh] 安装器已加入 web profile。请重启 dsh web。"
  } catch {
    Write-Warning "无法下载安装器（检查是否接入 目录站所在网络，或检查 CHENGYUAN_CATALOG_URL 指定的目录站）。可稍后手动装。$_"
  }
}

Write-Host ""
Write-Host "下一步："
Write-Host "  每位师生使用本机 DSH，仅共用局域网目录站下载安装器/技能。"
Write-Host "  1) 本机启动 DSH Web：$StartCmd"
Write-Host "             浏览器打开 http://127.0.0.1:3080"
Write-Host "  2) 设置 → Models：填入国内 API Key（参考 $exampleDst）"
Write-Host "  3) 打开局域网目录站（下载安装器/技能）：$CatalogUrl/"
Write-Host "  4) 对话里安装通用 skill（如 chengyuan-study-coach）"
Write-Host "  如设置了 CHENGYUAN_CATALOG_URL，启动 DSH 时也需保留该环境变量。"
Write-Host "详细说明见 docs\10分钟上手.md"
