const fs = require('fs');
let types = fs.readFileSync('src/types.ts', 'utf8');

types = types.replace(
  "export interface NotificationItem {\n  id: string;\n  userId?: string;\n  clientId?: string;\n  title: string;\n  message: string;\n  channel: 'INTERNAL' | 'EMAIL' | 'WHATSAPP' | 'SMS';\n  status: 'ENVOYE' | 'EN_ATTENTE' | 'ECHEC';\n  createdAt: string;\n}",
  `export interface AppNotification {
  id?: string;
  recipientUserId: string;
  recipientClientId?: string;
  inscriptionId?: string;
  type: string;
  category: 'SYSTEM' | 'PAYMENT' | 'DOCUMENT' | 'LOGISTICS' | 'GENERAL';
  title: string;
  message: string;
  entityType?: 'payment' | 'document' | 'visa' | 'flight' | 'hotel' | 'inscription' | 'client';
  entityId?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  isRead: boolean;
  readAt?: any;
  createdAt: any;
  expiresAt?: any;
  actionUrl?: string;
  metadata?: Record<string, any>;
}`
);

fs.writeFileSync('src/types.ts', types);
