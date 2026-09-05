const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

content = content.replace(
  "    match /notifications/{notifId} {\n      allow read: if isAuthenticated() && (\n        isStaff() || \n        (isPilgrim() && resource.data.userId == request.auth.uid) ||\n        (isPilgrim() && 'clientId' in resource.data && isPilgrimOwner(resource.data.clientId))\n      );\n      allow write: if isAuthenticated() && isActive() && isStaff();\n    }",
  `    match /notifications/{notifId} {\n      allow read: if isAuthenticated() && (\n        isStaff() || \n        (isPilgrim() && resource.data.recipientUserId == request.auth.uid)\n      );\n      allow create: if false; // Only server or staff via backend can create\n      allow update: if isAuthenticated() && (\n        isStaff() || \n        (isPilgrim() && resource.data.recipientUserId == request.auth.uid && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isRead', 'readAt']))\n      );\n      allow delete: if isAuthenticated() && isStaff();\n    }`
);

fs.writeFileSync('firestore.rules', content);
