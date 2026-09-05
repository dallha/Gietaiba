const fs = require('fs');
let content = fs.readFileSync('server/db.ts', 'utf8');

content = content.replace("notifications: [];", "notifications: any[];");

fs.writeFileSync('server/db.ts', content);
