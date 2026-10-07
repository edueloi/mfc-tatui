# Script para corrigir encoding UTF-8 nos arquivos do frontend
$ErrorActionPreference = "Continue"

$files = Get-ChildItem -Path "front" -Include *.tsx,*.ts,*.jsx,*.js -Recurse

Write-Host "Corrigindo arquivos..." -ForegroundColor Yellow

$replacements = @(
    @('Ã§Ã£', 'ção'),
    @('Ã§Ãµ', 'çõ'),
    @('Ã§', 'ç'),
    @('Ã£', 'ã'),
    @('Ã¡', 'á'),
    @('Ã©', 'é'),
    @('Ãª', 'ê'),
    @('Ã­', 'í'),
    @('Ã³', 'ó'),
    @('Ãº', 'ú'),
    @('Ã‡', 'Ç'),
    @('Ãµ', 'õ'),
    @('Ã', 'Á'),
    @('Ã©', 'É'),
    @('Ã"', 'Ó')
)

$count = 0
foreach ($file in $files) {
    try {
        $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
        $content = [System.Text.Encoding]::UTF8.GetString($bytes)
        $originalContent = $content
        
        foreach ($pair in $replacements) {
            $content = $content -replace $pair[0], $pair[1]
        }
        
        if ($content -ne $originalContent) {
            $utf8NoBom = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
            Write-Host "Corrigido: $($file.Name)" -ForegroundColor Green
            $count++
        }
    } catch {
        Write-Host "Erro em $($file.Name): $_" -ForegroundColor Red
    }
}

Write-Host "`nTotal de arquivos corrigidos: $count" -ForegroundColor Cyan
