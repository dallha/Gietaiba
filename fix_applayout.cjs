const fs = require('fs');

let content = fs.readFileSync('src/components/layout/AppLayout.tsx', 'utf8');

content = content.replace(
  "            <NotificationBell\n              payments={payments}\n              documents={documents}\n              clients={clients}\n              onNavigate={navigate}\n              onOpenReceipt={onOpenReceipt}\n            />",
  "            <NotificationBell\n              onNavigate={navigate}\n            />"
);

fs.writeFileSync('src/components/layout/AppLayout.tsx', content);

