const fs = require('fs');
let content = fs.readFileSync('src/components/notifications/NotificationBell.tsx', 'utf8');
content = content.replace("  const unreadCount = notifications.filter((n) => !n.isRead).length;", "");
fs.writeFileSync('src/components/notifications/NotificationBell.tsx', content);
