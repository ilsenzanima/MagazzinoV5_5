<#
.SYNOPSIS
Replaces all alert() calls with notify toast notifications
#>

$srcPath = "d:\Magazzino\MagazzinoV5_5\src"

# Find all .tsx and .ts files with alert( calls
$files = Get-ChildItem -Path $srcPath -Recurse -Include *.tsx,*.ts | 
    Select-String -Pattern 'alert\(' -List | 
    Select-Object -ExpandProperty Path -Unique

Write-Host "Found $($files.Count) files with alert() calls"

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    
    # Check if notify is already imported
    $hasNotifyImport = $content -match 'import.*notify.*from.*"@/lib/notify"'
    
    # Add import if not present
    if (-not $hasNotifyImport) {
        # Find the last import statement
        if ($content -match '(?s)(.*)(import [^;]+;)(\r?\n)') {
            $content = $content -replace '(?s)(.*)(import [^;]+;)(\r?\n)(?!import)', "`$1`$2`$3import { notify } from `"@/lib/notify`";`$3"
        }
    }
    
    # Replace error alerts
    $content = $content -replace 'alert\("Errore', 'notify.error("Errore'
    $content = $content -replace "alert\('Errore", "notify.error('Errore"
    $content = $content -replace 'alert\("Errore nel', 'notify.error("Errore nel'
    
    # Replace warning/validation alerts  
    $content = $content -replace 'alert\("Inserisci', 'notify.warning("Inserisci'
    $content = $content -replace 'alert\("Seleziona', 'notify.warning("Seleziona'
    $content = $content -replace 'alert\("Compila', 'notify.warning("Compila'
    $content = $content -replace 'alert\("Devi', 'notify.warning("Devi'
    $content = $content -replace 'alert\("La quantità', 'notify.warning("La quantità'
    $content = $content -replace 'alert\("Quantità', 'notify.warning("Quantità'
    $content = $content -replace 'alert\(`Quantità', 'notify.warning(`Quantità'
    $content = $content -replace 'alert\("Esiste già', 'notify.warning("Esiste già'
    $content = $content -replace 'alert\("Articolo già', 'notify.warning("Articolo già'
    
    # Replace success alerts
    $content = $content -replace 'alert\("Modifiche salvate', 'notify.success("Modifiche salvate'
    $content = $content -replace 'alert\("Profilo aggiornato', 'notify.success("Profilo aggiornato'
    $content = $content -replace 'alert\(`✓', 'notify.success(`✓'
    
    # Replace info/other alerts
    $content = $content -replace 'alert\(`✗', 'notify.error(`✗'
    
    # Generic remaining alerts to error
    $content = $content -replace 'alert\("Si è verificato', 'notify.error("Si è verificato'
    
    Set-Content $file -Value $content -NoNewline
    Write-Host "Updated: $file"
}

Write-Host "Done! Updated $($files.Count) files"
