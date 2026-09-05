const fs = require('fs');
let content = fs.readFileSync('src/modules/users/UsersRolesModule.tsx', 'utf8');

content = content.replace(
  "  useEffect(() => {\n    fetchData();\n  }, []);",
  "  useEffect(() => {\n    if (hasPermission('users.view') || currentUser?.roleId === 'SUPER_ADMIN') {\n      fetchData();\n    } else {\n      setLoading(false);\n    }\n  }, [currentUser]);"
);

fs.writeFileSync('src/modules/users/UsersRolesModule.tsx', content);
