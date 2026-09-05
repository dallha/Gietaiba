const fs = require('fs');
let content = fs.readFileSync('src/components/pilgrim/PilgrimTypes.ts', 'utf8');

content = content.replace(
  "export interface PilgrimPortalNotification {\n  id: string;\n  type: 'PAYMENT' | 'DOCUMENT' | 'VISA' | 'FLIGHT' | 'INFO';\n  title: string;\n  message: string;\n  date: string;\n  isRead?: boolean;\n  linkTab?: PilgrimTab;\n}",
  ""
);

fs.writeFileSync('src/components/pilgrim/PilgrimTypes.ts', content);
