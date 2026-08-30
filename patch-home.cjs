const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

// Imports
if (!c.includes('ScreenReactions')) {
  c = c.replace(
    'import { MusicRoomPanel } from "@/components/MusicRoomPanel";',
    'import { MusicRoomPanel } from "@/components/MusicRoomPanel";\nimport { ScreenReactions, type ReactionEvent } from "@/components/ScreenReactions";'
  );
}

// State
if (!c.includes('const [reactions, setReactions]')) {
  const stateInjection = `
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const sendReaction = (emoji: string) => {
    const x = window.innerWidth / 2;
    const y = window.innerHeight;
    const id = Date.now().toString() + Math.random();
    setReactions(cur => [...cur, { id, emoji, x, y }]);
    socketRef.current.emit("chat:reaction", { channelId: selectedChannelId, emoji });
    setTimeout(() => {
      setReactions(cur => cur.filter(r => r.id !== id));
    }, 2000);
  };
  `;
  c = c.replace(
    'const [typingNames, setTypingNames] = useState<string[]>([]);',
    'const [typingNames, setTypingNames] = useState<string[]>([]);' + stateInjection
  );
}

// Socket handler
if (!c.includes('chat:reaction')) {
  const socketInjection = `
    socket.on("chat:reaction", ({ emoji, userId, name }: { emoji: string, userId: string, name: string }) => {
      if (userId === profile.id) return;
      const x = Math.random() * window.innerWidth;
      const y = window.innerHeight;
      const id = Date.now().toString() + Math.random();
      setReactions(cur => [...cur, { id, emoji, x, y }]);
      setTimeout(() => {
        setReactions(cur => cur.filter(r => r.id !== id));
      }, 2000);
    });
  `;
  c = c.replace(
    'socket.on(\n      "typing",',
    socketInjection + '\n    socket.on(\n      "typing",'
  );
}

// Typing UI
const oldTyping = '{typingNames.length > 0 && (\n                  <p className="mt-3 px-2 text-xs text-orange-300">\n                    {typingNames.join(", ")} digitando…\n                  </p>\n                )}';
const newTyping = `{typingNames.length > 0 && (
                  <div className="mt-3 px-2 flex items-center gap-2 text-xs text-orange-300/80">
                    <span className="truncate max-w-[200px]">{typingNames.join(", ")}</span>
                    <span className="flex items-center gap-1">
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0 }} className="size-1 rounded-full bg-orange-400" />
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.2 }} className="size-1 rounded-full bg-orange-400" />
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.4 }} className="size-1 rounded-full bg-orange-400" />
                    </span>
                  </div>
                )}`;
c = c.replace(oldTyping, newTyping);

// Reaction button
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

// Global ScreenReactions
c = c.replace(
  '<main onDragOver={e => e.preventDefault()} onDrop={handleDrop} className="vybe-app vybe-cyber-grid flex h-[100dvh] w-full text-slate-300 overflow-hidden">',
  '<main onDragOver={e => e.preventDefault()} onDrop={handleDrop} className="vybe-app vybe-cyber-grid flex h-[100dvh] w-full text-slate-300 overflow-hidden">\n      <ScreenReactions reactions={reactions} />'
);

fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
console.log('patched home');
