const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  "match /{path=**}/flights/{id} {\n      allow read: if isAuthenticated();\n      allow write: if isAuthenticated() && isActive() && hasRolePermission('logistique.update');\n    }",
  "match /{path=**}/flights/{id} {\n      allow read: if isAuthenticated();\n      allow write: if isAuthenticated() && isActive() && hasRolePermission('logistique.update');\n    }\n    match /{path=**}/hotels/{id} {\n      allow read: if isAuthenticated();\n      allow write: if isAuthenticated() && isActive() && hasRolePermission('logistique.update');\n    }"
);

fs.writeFileSync('firestore.rules', rules);
