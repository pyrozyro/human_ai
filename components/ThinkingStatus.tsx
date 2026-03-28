'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { THINKING_MESSAGES } from '@/lib/xp';

export default function ThinkingStatus() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % THINKING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2">
      {/* Typing dots */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-yellow-400 font-medium">AI sedang berfikir</span>
        <div className="flex gap-1 ml-1">
          <div className="typing-dot w-1.5 h-1.5 bg-yellow-400 rounded-full" />
          <div className="typing-dot w-1.5 h-1.5 bg-yellow-400 rounded-full" />
          <div className="typing-dot w-1.5 h-1.5 bg-yellow-400 rounded-full" />
        </div>
      </div>

      {/* Rotating funny message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.3 }}
          className="text-xs text-gray-300 italic"
        >
          {THINKING_MESSAGES[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
