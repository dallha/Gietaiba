const fs = require('fs');
const file = 'src/auth/AuthContext.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add neonAuthClient import
content = content.replace(
  "import { api } from '../services/api.js';",
  "import { api } from '../services/api.js';\nimport { neonAuthClient } from './neonClient.js';"
);

// Update logoutUser
content = content.replace(
  /const logoutUser = useCallback\(async \(\) => \{\n\s*await api\.logout\(\);\n\s*setCurrentUser\(null\);\n\s*setRole\(null\);\n\s*\}, \[\]\);/,
  `const logoutUser = useCallback(async () => {
    try {
      await neonAuthClient.signOut();
    } catch (e) {
      console.warn('Neon Auth signOut error', e);
    }
    await api.logout();
    setCurrentUser(null);
    setRole(null);
  }, []);`
);

fs.writeFileSync(file, content);
