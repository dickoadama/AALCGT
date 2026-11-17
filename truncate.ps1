$c = Get-Content 'f:\news\index.html' -TotalCount 1366 -Encoding UTF8
$c | Set-Content 'f:\news\index.html' -Encoding UTF8
