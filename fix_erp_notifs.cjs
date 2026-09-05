const fs = require('fs');

let content = fs.readFileSync('src/components/notifications/NotificationBell.tsx', 'utf8');

// Replace the imports to include useNotifications
content = content.replace("import { Payment, PilgrimDocument, Client } from '../../types.js';", "import { Payment, PilgrimDocument, Client, AppNotification } from '../../types.js';\nimport { useNotifications } from '../../hooks/useNotifications.js';\nimport { markAsRead, markAllAsRead } from '../../services/notification.service.js';\nimport { useAuth } from '../../auth/AuthContext.js';");

// Remove the old AppNotification interface definition
content = content.replace(/export interface AppNotification {[\s\S]*?}/, "");

// Modify the component props and signature
const propStr = `interface NotificationBellProps {
  payments: Payment[];
  documents: PilgrimDocument[];
  clients: Client[];
  onNavigate: (module: string) => void;
  onOpenReceipt?: (payment: Payment) => void;
}`;
content = content.replace(propStr, "interface NotificationBellProps {\n  onNavigate: (module: string) => void;\n}");

content = content.replace("export const NotificationBell: React.FC<NotificationBellProps> = ({\n  payments,\n  documents,\n  clients,\n  onNavigate,\n  onOpenReceipt,\n}) => {", "export const NotificationBell: React.FC<NotificationBellProps> = ({\n  onNavigate,\n}) => {");

// Remove local storage logic
content = content.replace(/  const \[readIds, setReadIds\] = useState[\s\S]*?\}\);/, "");

// Insert the hook
content = content.replace("  const dropdownRef = useRef<HTMLDivElement>(null);", "  const { currentUser } = useAuth();\n  const { notifications, unreadCount } = useNotifications();\n  const dropdownRef = useRef<HTMLDivElement>(null);");

// Remove the old notifications array generation
content = content.replace(/  const notifications: AppNotification\[\] = \[\];[\s\S]*?notifications\.sort\(\(a, b\) => new Date\(b\.timestamp\)\.getTime\(\) - new Date\(a\.timestamp\)\.getTime\(\)\);/, "");

// Fix handleNotificationClick
const clickFnOld = `  const handleNotificationClick = (notif: AppNotification) => {
    // Marquer comme lu
    const nextIds = new Set(readIds);
    nextIds.add(notif.id);
    setReadIds(nextIds);
    localStorage.setItem('erp_read_notifications', JSON.stringify([...nextIds]));

    setIsOpen(false);

    if (notif.type === 'PAYMENT') {
      const payment = payments.find((p) => p.id === notif.referenceId);
      if (payment && onOpenReceipt) {
        onOpenReceipt(payment);
      } else {
        onNavigate('paiements');
      }
    } else if (notif.type === 'DOCUMENT') {
      onNavigate('documents');
    }
  };`;

const clickFnNew = `  const handleNotificationClick = (notif: AppNotification) => {
    if (notif.id && !notif.isRead) {
      markAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.actionUrl) {
      onNavigate(notif.actionUrl);
    }
  };`;

content = content.replace(clickFnOld, clickFnNew);

// Fix markAllAsRead handler
const markAllOld = `  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(new Set(allIds));
    localStorage.setItem('erp_read_notifications', JSON.stringify(allIds));
  };`;

const markAllNew = `  const handleMarkAllAsRead = () => {
    if (currentUser) {
      markAllAsRead(currentUser.id);
    }
  };`;
content = content.replace(markAllOld, markAllNew);
content = content.replace(/onClick={markAllAsRead}/g, "onClick={handleMarkAllAsRead}");

// Fix timestamp field accesses
content = content.replace(/notif\.timestamp/g, "(notif.createdAt?.toDate ? notif.createdAt.toDate().toISOString() : '')");
content = content.replace(/notif\.description/g, "notif.message");

fs.writeFileSync('src/components/notifications/NotificationBell.tsx', content);

