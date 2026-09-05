const fs = require('fs');
let content = fs.readFileSync('server/db.ts', 'utf8');

content = content.replace(/const notifications: \[\] = \[\n[\s\S]*?\];/m, "const notifications: any[] = [];");

fs.writeFileSync('server/db.ts', content);
