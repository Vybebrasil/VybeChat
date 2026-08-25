const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');
c = c.replace('<div className="vybe-timeline-scroll flex-1 overflow-y-auto">', '<div className="vybe-timeline-scroll flex-1 min-h-0 overflow-y-auto">');
fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
console.log('done');
