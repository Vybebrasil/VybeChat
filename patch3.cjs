const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

const dropHandler = `
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer) return;
    const files = Array.from(e.dataTransfer.files);
    const images = files.filter(f => f.type.startsWith("image/"));
    if (images.length) {
      const mockName = images[0].name.replace(/\\s+/g, "_");
      setDraft(prev => prev + (prev.trim() ? "\\n" : "") + \`![imagem_anexada](https://cdn.vybechat.dev/mock/\${mockName})\\n\`);
    }
  };
`;

c = c.replace('  const sendMessage = (event: FormEvent) => {', dropHandler + '\n  const sendMessage = (event: FormEvent) => {');
c = c.replace('<main className="vybe-app vybe-cyber-grid flex h-[100dvh] w-full text-slate-300 overflow-hidden">', '<main onDragOver={e => e.preventDefault()} onDrop={handleDrop} className="vybe-app vybe-cyber-grid flex h-[100dvh] w-full text-slate-300 overflow-hidden">');

fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
console.log('done3');
