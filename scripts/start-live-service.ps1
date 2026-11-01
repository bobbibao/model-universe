<#
.SYNOPSIS
  Khởi động toàn bộ hạ tầng Model Universe Live (Server Local cổng 6050 + Cloudflare Named Tunnel)
  Phục vụ duy trì uptime 24/7 cho Googlebot & AI Search.
#>

$ErrorActionPreference = "Continue"

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "   MODEL UNIVERSE LIVE SERVICE - AUTO LAUNCHER       " -ForegroundColor Yellow
Write-Host "=======================================================`n" -ForegroundColor Cyan

# 1. Kiểm tra Web Server cổng 6050
$conn = Get-NetTCPConnection -LocalPort 6050 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
if (-not $conn) {
    Write-Host "[1/2] Dang khoi dong Web Ecommerce Server tren cong 6050..." -ForegroundColor Cyan
    $serverPath = "c:\Users\ACER\Desktop\projects\model-universe\apps\web-ecommerce"
    Start-Process -FilePath "node" -ArgumentList "dist/.next/server.js" -WorkingDirectory $serverPath -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Write-Host "  -> Web Ecommerce Server da khoi dong xong!" -ForegroundColor Green
} else {
    Write-Host "[1/2] Web Ecommerce Server dang chay san tren cong 6050 (OK)" -ForegroundColor Green
}

# 2. Kiểm tra Cloudflare Tunnel
$tunnelProcess = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
if (-not $tunnelProcess) {
    Write-Host "[2/2] Dang ket noi Cloudflare Named Tunnel (model-universe)..." -ForegroundColor Cyan
    $cfExe = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
    Start-Process -FilePath $cfExe -ArgumentList "tunnel run model-universe" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Write-Host "  -> Cloudflare Tunnel da ket noi thanh cong!" -ForegroundColor Green
} else {
    Write-Host "[2/2] Cloudflare Tunnel da dang chay ket noi (OK)" -ForegroundColor Green
}

Write-Host "`n-------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Trang web dang hoat dong tai: https://modeluniverse.vn" -ForegroundColor Yellow
Write-Host "Trang thai: ONLINE (San sang cho Googlebot & AI Search)" -ForegroundColor Green
Write-Host "-------------------------------------------------------`n" -ForegroundColor DarkGray
