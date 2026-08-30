import { motion, AnimatePresence } from "framer-motion";

export type ReactionEvent = {
  id: string;
  emoji: string;
  x: number;
  y: number;
};

export function ScreenReactions({ reactions }: { reactions: ReactionEvent[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{ opacity: 0, y: reaction.y, x: reaction.x, scale: 0.5 }}
            animate={{ 
              opacity: [0, 1, 1, 0], 
              y: reaction.y - 150 - Math.random() * 100, 
              x: reaction.x + (Math.random() * 60 - 30),
              scale: [0.5, 1.2, 1, 1.1] 
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute text-5xl drop-shadow-2xl"
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
