param([Parameter(Mandatory = $true)][string]$Path)
$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $Path).Path
$excel = $null
$book = $null
try {
    # Instância própria, invisível e somente leitura. Não usa o Excel aberto pelo usuário.
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.EnableEvents = $false
    $excel.AutomationSecurity = 3
    $book = $excel.Workbooks.Open($resolved, 0, $true)
    $checked = 0
    foreach ($sheet in $book.Worksheets) {
        if ([string]$sheet.Cells.Item(1, 1).Value2 -like 'EQUIPE | *') {
            if ($sheet.UsedRange.Rows.Count -lt 7 -or $sheet.ListObjects.Count -ne 3) {
                throw 'O Excel perdeu conteúdo ou tabelas de uma equipe.'
            }
            if ($sheet.Comments.Count -lt 12) { throw 'Os comentários das mensalidades não foram preservados.' }
            $checked++
        }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($sheet)
    }
    if ($checked -eq 0) { throw 'Nenhuma aba de equipe encontrada no Excel.' }
    if ($book.Worksheets.Item('Painel').ChartObjects().Count -ne 2) { throw 'Os gráficos do painel não foram preservados.' }
    Write-Output "Excel nativo: $checked abas de equipes abertas com dados, tabelas e comentários."
} finally {
    if ($null -ne $book) { $book.Close($false); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($book) }
    if ($null -ne $excel) { $excel.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
}
