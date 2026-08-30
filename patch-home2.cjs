const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

c = c.replace(
  '<main onDragOver={e => e.preventDefault()} onDrop={handleDrop} className="vybe-app vybe-cyber-grid flex h-[100dvh] w-full text-slate-300 overflow-hidden">',
  '<main onDragOver={e => e.preventDefault()} onDrop={handleDrop} className="vybe-app vybe-cyber-grid flex h-[100dvh] w-full text-slate-300 overflow-hidden">\n      <ScreenReactions reactions={reactions} />'
);

const buttonSearch = '<Button\n                    type="submit"';
if (c.includes(buttonSearch)) {
  const buttonInjection = `
                  <button
                    type="button"
                    onClick={() => sendReaction("🔥")}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/5 bg-black/20 text-stone-400 hover:bg-orange-500/10 hover:text-orange-400"
                    aria-label="Reagir"
                  >
                    🔥
                  </button>
                  <Button
                    type="submit"`;
  c = c.replace(buttonSearch, buttonInjection);
}

fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
console.log('patched successfully');
