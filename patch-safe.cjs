const fs = require('fs');

// PATCH SERVER
let serverContent = fs.readFileSync('server/realtime.ts', 'utf8');
const serverInjection = `
    socket.on("chat:reaction", ({ channelId, emoji }: { channelId?: number; emoji?: string }) => {
      if (!channelId || !emoji) return;
      const user = socketPresence.get(socket.id);
      if (!user) return;
      io.to(roomName(channelId)).emit("chat:reaction", {
        channelId,
        emoji: String(emoji).slice(0, 10),
        userId: user.userId,
        name: user.name
      });
    });
`;
serverContent = serverContent.replace('socket.on("typing",', serverInjection + '\n    socket.on("typing",');
fs.writeFileSync('server/realtime.ts', serverContent);

// PATCH DRAWERS
const patchDrawer = (file) => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('framer-motion')) return;
  content = `import { motion, AnimatePresence } from "framer-motion";\n` + content;
  
  // They all have fixed inset-y-0 right-0 z-[XX]
  const drawerRegex = /{open && \(\s*<section className="([^"]+fixed inset-y-0 right-0[^"]+)"(.*?)>/s;
  
  content = content.replace(drawerRegex, (match, className, rest) => {
    return `<AnimatePresence>
      {open && (
        <motion.section 
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="${className}"${rest}>`;
  });
  content = content.replace('</section>\n      )}', '</motion.section>\n      )}\n      </AnimatePresence>');
  fs.writeFileSync(file, content);
};

patchDrawer('client/src/components/DirectMessagesDrawer.tsx');
patchDrawer('client/src/components/DecisionsDrawer.tsx');
patchDrawer('client/src/components/CollaborationDrawer.tsx');

console.log('patched everything');
