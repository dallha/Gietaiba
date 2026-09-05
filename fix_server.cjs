const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Fix updated.name to updated.fileName
content = content.replace(/updated\.name \|\| updated\.type/g, "updated.fileName || updated.type");

fs.writeFileSync('server.ts', content);

let dbContent = fs.readFileSync('server/db.ts', 'utf8');
dbContent = dbContent.replace(/NotificationItem,? ?/g, "");
fs.writeFileSync('server/db.ts', dbContent);
