const fs = require('fs');
const lines = fs.readFileSync('f:\\news\\index.html', 'utf8').split('\n');
const truncated = lines.slice(0, 1366).join('\n') + '\n';
fs.writeFileSync('f:\\news\\index.html', truncated, 'utf8');
console.log('Done. Lines:', lines.length, '-> 1366');
