const fs = require('fs');
let content = fs.readFileSync('src/components/notifications/NotificationBell.tsx', 'utf8');
content = content.replace(";}", "");
content = content.replace(";\n}", "");
fs.writeFileSync('src/components/notifications/NotificationBell.tsx', content);
