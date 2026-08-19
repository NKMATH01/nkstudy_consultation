# ============================================================
#  claudecode-consult:// 프로토콜 등록 (현재 사용자 전용)
#
#  이걸 한 번 실행해 두면 등록·퇴원 프로그램 상단 바의 "Claude Code" 버튼이
#  이 PC 에서 Claude Code CLI 를 띄운다.
#
#  · 관리자 권한이 필요 없다 — HKCU(현재 사용자)에만 쓴다.
#  · 실행하는 PC 마다 한 번씩 해야 한다(등록은 그 PC 에만 남는다).
#  · 되돌리려면 unregister.ps1 을 실행한다.
#
#  실행:  powershell -ExecutionPolicy Bypass -File .\register.ps1
# ============================================================

$ErrorActionPreference = 'Stop'

$launcher = Join-Path $PSScriptRoot 'open-claude.cmd'
if (-not (Test-Path $launcher)) {
  Write-Error "런처를 찾을 수 없습니다: $launcher"
  exit 1
}

# claude 명령이 있는지 먼저 확인한다 — 없으면 버튼을 눌러도 창만 뜨고 끝난다.
$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) {
  Write-Warning "이 PC 에 claude 명령이 없습니다. Claude Code 를 먼저 설치하고 로그인해 주세요."
  Write-Warning "설치 후 이 스크립트를 다시 실행하면 됩니다. (등록은 계속 진행합니다)"
}

$root = 'HKCU:\Software\Classes\claudecode-consult'

New-Item -Path $root -Force | Out-Null
Set-ItemProperty -Path $root -Name '(Default)' -Value 'URL:Claude Code Protocol'
# 이 값이 있어야 Windows 가 URL 프로토콜로 인식한다.
Set-ItemProperty -Path $root -Name 'URL Protocol' -Value ''

New-Item -Path "$root\shell\open\command" -Force | Out-Null
# %1(URL)은 런처에 넘기지만 런처가 쓰지 않는다 — 무엇을 열지는 런처 위치로만 정한다.
Set-ItemProperty -Path "$root\shell\open\command" -Name '(Default)' `
  -Value ('"{0}" "%1"' -f $launcher)

Write-Host ''
Write-Host '등록을 마쳤습니다.' -ForegroundColor Green
Write-Host ("  런처   : {0}" -f $launcher)
Write-Host ("  저장소 : {0}" -f (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path)
Write-Host ''
Write-Host '등록·퇴원 프로그램 상단 바에서 "Claude Code" 버튼을 누르면 열립니다.'
Write-Host '브라우저가 "이 사이트에서 Claude Code 를 여시겠습니까?" 라고 물으면 허용해 주세요.'
