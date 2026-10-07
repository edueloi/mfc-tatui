# Script para corrigir encoding UTF-8 nos arquivos do backend
$ErrorActionPreference = "Continue"

$files = Get-ChildItem -Path "back" -Include *.js,*.json -Recurse | Where-Object { $_.FullName -notmatch 'node_modules' }

Write-Host "Corrigindo arquivos do backend..." -ForegroundColor Yellow

$count = 0
foreach ($file in $files) {
    try {
        # Ler como bytes para evitar problemas de encoding
        $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
        $content = [System.Text.Encoding]::UTF8.GetString($bytes)
        $originalContent = $content
        
        # Corrigir padrões comuns de encoding errado (UTF-8 lido como Latin1)
        $content = $content -replace 'TatuÃ­', 'Tatuí'
        $content = $content -replace 'Ã§', 'ç'
        $content = $content -replace 'Ã£', 'ã'
        $content = $content -replace 'Ã¡', 'á'
        $content = $content -replace 'Ã©', 'é'
        $content = $content -replace 'Ãª', 'ê'
        $content = $content -replace 'Ã­', 'í'
        $content = $content -replace 'Ã³', 'ó'
        $content = $content -replace 'Ãº', 'ú'
        $content = $content -replace 'Ã‡', 'Ç'
        $content = $content -replace 'Ãµ', 'õ'
        $content = $content -replace 'Ã', 'Á'
        $content = $content -replace 'Ã‰', 'É'
        $content = $content -replace 'MarÃ§o', 'Março'
        $content = $content -replace 'VisÃ£o', 'Visão'
        $content = $content -replace 'gestÃ£o', 'gestão'
        $content = $content -replace 'atualizaÃ§Ã£o', 'atualização'
        $content = $content -replace 'UsuÃ¡rio', 'Usuário'
        $content = $content -replace 'usuÃ¡rio', 'usuário'
        
        if ($content -ne $originalContent) {
            # Salvar com UTF-8 sem BOM
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
