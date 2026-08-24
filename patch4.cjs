const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

c = c.replace('<div className="vybe-message-list">', '<div className="vybe-message-list">\n<AnimatePresence initial={false}>');
c = c.replace('</Fragment>\n                    ))}', '</Fragment>\n                    )}\n</AnimatePresence>');

fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
console.log('done4');
