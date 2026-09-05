const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes('sendNotification')) {
  content = content.replace(
    "import { db } from './server/db.js';",
    "import { db } from './server/db.js';\nimport { sendNotification } from './server/notification.service.js';"
  );
}

// 1. Payment Validated
content = content.replace(
  "    const updated = db.updatePaymentStatus(req.params.id, status, comment, user);\n    res.json(updated);",
  "    const updated = db.updatePaymentStatus(req.params.id, status, comment, user);\n    if (status === 'VALIDE' || status === 'VALIDATED') {\n      sendNotification({\n        recipientClientId: updated.clientId,\n        inscriptionId: updated.inscriptionId,\n        type: 'PAYMENT_VALIDATED',\n        category: 'PAYMENT',\n        title: `Paiement validé (${updated.receiptNumber || 'Reçu'})`,\n        message: `Un versement de ${updated.amount.toLocaleString()} FCFA a été comptabilisé sur votre dossier.`,\n        entityType: 'payment',\n        entityId: updated.id,\n        priority: 'HIGH',\n        actionUrl: 'finances'\n      });\n    }\n    res.json(updated);"
);

// 2. Document Status Changed
content = content.replace(
  "    const updated = db.updateDocumentStatus(req.params.id, status, comment, user);\n    res.json(updated);",
  "    const updated = db.updateDocumentStatus(req.params.id, status, comment, user);\n    if (status === 'VALIDE' || status === 'VALIDATED') {\n      sendNotification({\n        recipientClientId: updated.clientId,\n        type: 'DOCUMENT_VALIDATED',\n        category: 'DOCUMENT',\n        title: `Pièce validée : ${updated.name || updated.type}`,\n        message: `Votre document a été examiné et validé.`,\n        entityType: 'document',\n        entityId: updated.id,\n        priority: 'MEDIUM',\n        actionUrl: 'documents'\n      });\n    } else if (status === 'REJETE' || status === 'REJECTED') {\n      sendNotification({\n        recipientClientId: updated.clientId,\n        type: 'DOCUMENT_REJECTED',\n        category: 'DOCUMENT',\n        title: `Pièce rejetée : ${updated.name || updated.type}`,\n        message: `Votre document a été rejeté. Motif: ${comment || 'Non conforme'}`,\n        entityType: 'document',\n        entityId: updated.id,\n        priority: 'HIGH',\n        actionUrl: 'documents'\n      });\n    }\n    res.json(updated);"
);

// 3. Visa updated
content = content.replace(
  "    const updated = db.updateVisa(req.params.id, req.body, user);\n    res.json(updated);",
  "    const updated = db.updateVisa(req.params.id, req.body, user);\n    if (req.body.statut === 'VALIDE' || req.body.statut === 'EMIS') {\n      sendNotification({\n        recipientClientId: updated.clientId,\n        type: 'VISA_AVAILABLE',\n        category: 'LOGISTICS',\n        title: `Visa officiel délivré`,\n        message: `Votre visa pour le Royaume d'Arabie Saoudite est validé par le Ministère.`,\n        entityType: 'visa',\n        entityId: updated.id,\n        priority: 'HIGH',\n        actionUrl: 'dossier'\n      });\n    }\n    res.json(updated);"
);

fs.writeFileSync('server.ts', content);
