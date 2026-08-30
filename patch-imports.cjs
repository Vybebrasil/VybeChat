const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

if (!c.includes('ModeSelection')) {
  c = c.replace('import { TeamLogin } from "@/components/TeamLogin";', 'import { TeamLogin } from "@/components/TeamLogin";\nimport { ModeSelection, type AppMode } from "@/components/ModeSelection";\nimport { GamingLogin } from "@/components/GamingLogin";');
}

fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
