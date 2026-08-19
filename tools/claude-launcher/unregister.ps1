# claudecode-consult:// 프로토콜 등록 해제 (현재 사용자 전용)
#
# 실행:  powershell -ExecutionPolicy Bypass -File .\unregister.ps1

$ErrorActionPreference = 'Stop'

$root = 'HKCU:\Software\Classes\claudecode-consult'

if (Test-Path $root) {
  Remove-Item -Path $root -Recurse -Force
  Write-Host '등록을 해제했습니다. 상단 바의 버튼은 이제 아무 일도 하지 않습니다.' -ForegroundColor Green
} else {
  Write-Host '등록되어 있지 않습니다.' -ForegroundColor Yellow
}
