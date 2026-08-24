const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

c = c.replace('<article className="vybe-message flex gap-3">', '<motion.article layout initial={{opacity:0, y:15}} animate={{opacity:1, y:0}} className="vybe-message flex gap-3">');

// We have multiple </article> possibly, let's only replace the first one after the match
const idx = c.indexOf('<motion.article layout');
if (idx > -1) {
  const closeIdx = c.indexOf('</article>', idx);
  if (closeIdx > -1) {
    c = c.slice(0, closeIdx) + '</motion.article>' + c.slice(closeIdx + 10);
  }
}

c = c.replace(
  '<p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-stone-300">\n                                {normalizeExternalMessage(message.content)}\n                              </p>',
  '<div className="mt-0.5 text-sm leading-6 text-stone-300"><CyberMarkdown content={normalizeExternalMessage(message.content)} /></div>'
);

fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
console.log('done');
