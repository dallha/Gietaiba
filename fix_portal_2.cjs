const fs = require('fs');
let content = fs.readFileSync('src/pages/PilgrimPortal.tsx', 'utf8');

// Replace the notifications prop in PilgrimNotificationsView
content = content.replace(
  "        {activeTab === 'notifications' && (\n          <PilgrimNotificationsView\n            notifications={portalNotifications}\n            onNavigateTab={handleSelectTab}\n          />\n        )}",
  "        {activeTab === 'notifications' && (\n          <PilgrimNotificationsView\n            notifications={portalNotifications}\n            onNavigateTab={handleSelectTab}\n            onMarkAsRead={markAsRead}\n            onMarkAllAsRead={() => currentUser && markAllAsRead(currentUser.id)}\n          />\n        )}"
);

fs.writeFileSync('src/pages/PilgrimPortal.tsx', content);
