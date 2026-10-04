#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Injeta a chave Supabase no index.html para testes locais
.EXAMPLE
    .\scripts\inject-supabase-key.ps1 -Key "sb_publishable_..."
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Key
)

$indexPath = Join-Path $PSScriptRoot '..' 'index.html'

if (-not (Test-Path $indexPath)) {
    Write-Host "❌ Erro: Arquivo index.html não encontrado" -ForegroundColor Red
    exit 1
}

if (-not $Key.StartsWith('sb_publishable_')) {
    Write-Host "❌ Erro: A chave deve começar com 'sb_publishable_'" -ForegroundColor Red
    exit 1
}

try {
    $content = Get-Content $indexPath -Raw
    $originalLength = $content.Length

    # Injetar chave
    $content = $content -replace `
        "window\.SUPABASE_KEY = window\.SUPABASE_KEY \|\| 'sb_publishable_[^']*'", `
        "window.SUPABASE_KEY = window.SUPABASE_KEY || '$Key'"

    if ($content.Length -eq $originalLength) {
        Write-Host "⚠️  Aviso: Padrão não encontrado, verificando se já foi injetado..." -ForegroundColor Yellow
    }

    Set-Content $indexPath $content
    Write-Host "✅ Chave Supabase injetada com sucesso!" -ForegroundColor Green
    Write-Host "📝 Arquivo: $indexPath"
    Write-Host "🔑 Chave: $($Key.Substring(0, 20))..."

} catch {
    Write-Host "❌ Erro ao injetar chave: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
