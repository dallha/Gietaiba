const fs = require('fs');
let content = fs.readFileSync('src/pages/PilgrimPortal.tsx', 'utf8');

// Add imports
if (!content.includes('useNotifications')) {
  content = content.replace(
    "import React, { useState, useEffect, useMemo } from 'react';",
    "import React, { useState, useEffect, useMemo } from 'react';\nimport { useNotifications } from '../hooks/useNotifications.js';\nimport { markAsRead, markAllAsRead } from '../services/notification.service.js';"
  );
}

// Remove the hardcoded portalNotifications and replace it with the hook
const startText = "  // Real Events & Notifications Generator (Requirement 13)";
const endText = "  }, [payments, documents, visas, flights, hotels]);";

const startIndex = content.indexOf(startText);
const endIndex = content.indexOf(endText);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) +
    `  // Real Events & Notifications (Firestore synced)\n  const { notifications: portalNotifications, unreadCount } = useNotifications();\n` +
    content.substring(endIndex + endText.length);
}

// Replace unreadNotificationsCount: portalNotifications.length -> unreadCount
content = content.replace(/unreadNotificationsCount={portalNotifications.length}/g, "unreadNotificationsCount={unreadCount}");
content = content.replace(/unreadCount={portalNotifications.length}/g, "unreadCount={unreadCount}");

// Wait, the components PilgrimNotificationsView need the AppNotification type now. Let's find PilgrimNotificationsView in the file or components folder.
fs.writeFileSync('src/pages/PilgrimPortal.tsx', content);
