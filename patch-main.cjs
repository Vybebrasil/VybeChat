const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

c = c.replace(
  '<main onDragOver={e => e.preventDefault()} onDrop={handleDrop} className="vybe-app vybe-cyber-grid flex h-[100dvh] w-full text-slate-300 overflow-hidden">',
  '<main onDragOver={e => e.preventDefault()} onDrop={handleDrop} className={`vybe-app vybe-cyber-grid flex h-[100dvh] w-full text-slate-300 overflow-hidden ${appMode === "vybegaming" ? "theme-gaming" : ""}`}>'
);

fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
