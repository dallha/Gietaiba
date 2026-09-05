const fs = require('fs');
let content = fs.readFileSync('src/pages/PilgrimPortal.tsx', 'utf8');

// We need to inject our hook and replace the static notifications.
content = content.replace("import React, { useState, useEffect, useMemo } from 'react';", "import React, { useState, useEffect, useMemo } from 'react';\nimport { useNotifications } from '../hooks/useNotifications.js';\nimport { markAsRead, markAllAsRead } from '../services/notification.service.js';");

const notificationCodeStart = content.indexOf("const portalNotifications: PilgrimPortalNotification[] = useMemo(() => {");
const notificationCodeEnd = content.indexOf("return list.sort((a, b) => b.date.getTime() - a.date.getTime());\n  }, [payments, documents, visas, flights, hotels]);");

if (notificationCodeStart > -1 && notificationCodeEnd > -1) {
  content = content.substring(0, notificationCodeStart) + `const { notifications: portalNotifications, unreadCount } = useNotifications();\n` + content.substring(notificationCodeEnd + "return list.sort((a, b) => b.date.getTime() - a.date.getTime());\n  }, [payments, documents, visas, flights, hotels]);".length);
}

// Find PilgrimNotifications props
content = content.replace("<PilgrimNotifications\n            notifications={portalNotifications}\n          />", `<PilgrimNotifications\n            notifications={portalNotifications}\n            onMarkAsRead={markAsRead}\n            onMarkAllAsRead={() => currentUser && markAllAsRead(currentUser.id)}\n          />`);

fs.writeFileSync('src/pages/PilgrimPortal.tsx', content);
