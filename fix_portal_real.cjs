const fs = require('fs');
let content = fs.readFileSync('src/pages/PilgrimPortal.tsx', 'utf8');

const startStr = "  // Real Events & Notifications Generator (Requirement 13)";
const endStr = "  }, [payments, documents, visas, flights, hotels]);";
const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex > -1 && endIndex > -1) {
  content = content.substring(0, startIndex) +
    `  // Real Events & Notifications (Firestore synced)\n  const { notifications: portalNotifications, unreadCount } = useNotifications();\n` +
    content.substring(endIndex + endStr.length);
}

// Remove PilgrimPortalNotification import
content = content.replace("PilgrimPortalNotification, ", "");
content = content.replace(", PilgrimPortalNotification", "");

fs.writeFileSync('src/pages/PilgrimPortal.tsx', content);
