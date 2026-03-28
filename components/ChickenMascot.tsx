'use client';

import { motion, type TargetAndTransition, type Transition } from 'framer-motion';

type MascotMood = 'idle' | 'thinking' | 'happy' | 'shocked' | 'sleeping';

interface ChickenMascotProps {
  mood?: MascotMood;
  size?: number;
}

const moodExpressions: Record<MascotMood, { eyes: string; mouth: string; color: string }> = {
  idle: { eyes: '• •', mouth: '‿', color: '#FFD700' },
  thinking: { eyes: '~ ~', mouth: '...', color: '#FFD700' },
  happy: { eyes: '^ ^', mouth: 'D', color: '#FFE44D' },
  shocked: { eyes: 'O O', mouth: 'O', color: '#FFB700' },
  sleeping: { eyes: '- -', mouth: 'z', color: '#FFCC00' },
};

export default function ChickenMascot({ mood = 'idle', size = 80 }: ChickenMascotProps) {
  const expr = moodExpressions[mood];

  const animationMap: Record<MascotMood, TargetAndTransition> = {
    idle: { y: [0, -6, 0] },
    thinking: { rotate: [-5, 5, -5] },
    happy: { scale: [1, 1.15, 1], rotate: [-5, 5, -5, 5, 0] },
    shocked: { scale: [1, 1.3, 1] },
    sleeping: { y: [0, 3, 0] },
  };

  const transitionMap: Record<MascotMood, Transition> = {
    idle: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
    thinking: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
    happy: { duration: 0.5, repeat: 2 },
    shocked: { duration: 0.3, repeat: 2 },
    sleeping: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  };

  return (
    <motion.div
      animate={animationMap[mood]}
      transition={transitionMap[mood]}
      style={{ width: size, height: size }}
      className="relative select-none"
    >
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
      >
        {/* Body */}
        <ellipse cx="50" cy="65" rx="28" ry="22" fill={expr.color} />

        {/* Head */}
        <circle cx="50" cy="38" r="24" fill={expr.color} />

        {/* Beak */}
        <polygon points="50,44 44,50 56,50" fill="#FF8C00" />

        {/* Comb */}
        <ellipse cx="50" cy="15" rx="6" ry="8" fill="#FF4444" />
        <ellipse cx="42" cy="17" rx="4" ry="6" fill="#FF4444" />
        <ellipse cx="58" cy="17" rx="4" ry="6" fill="#FF4444" />

        {/* Wattle */}
        <ellipse cx="50" cy="56" rx="5" ry="4" fill="#FF4444" />

        {/* Wings */}
        <ellipse cx="25" cy="68" rx="10" ry="6" fill={expr.color} transform="rotate(-20 25 68)" />
        <ellipse cx="75" cy="68" rx="10" ry="6" fill={expr.color} transform="rotate(20 75 68)" />

        {/* Feet */}
        <line x1="42" y1="87" x2="38" y2="95" stroke="#FF8C00" strokeWidth="3" strokeLinecap="round" />
        <line x1="42" y1="87" x2="46" y2="95" stroke="#FF8C00" strokeWidth="3" strokeLinecap="round" />
        <line x1="58" y1="87" x2="54" y2="95" stroke="#FF8C00" strokeWidth="3" strokeLinecap="round" />
        <line x1="58" y1="87" x2="62" y2="95" stroke="#FF8C00" strokeWidth="3" strokeLinecap="round" />

        {/* Eyes based on mood */}
        {mood === 'idle' && (
          <>
            <circle cx="43" cy="34" r="4" fill="#333" />
            <circle cx="57" cy="34" r="4" fill="#333" />
            <circle cx="44" cy="33" r="1.5" fill="white" />
            <circle cx="58" cy="33" r="1.5" fill="white" />
          </>
        )}
        {mood === 'thinking' && (
          <>
            <path d="M39 34 Q43 30 47 34" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M53 34 Q57 30 61 34" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        )}
        {mood === 'happy' && (
          <>
            <path d="M39 36 Q43 31 47 36" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M53 36 Q57 31 61 36" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        )}
        {mood === 'shocked' && (
          <>
            <circle cx="43" cy="34" r="5" fill="#333" />
            <circle cx="57" cy="34" r="5" fill="#333" />
            <circle cx="44" cy="33" r="2" fill="white" />
            <circle cx="58" cy="33" r="2" fill="white" />
          </>
        )}
        {mood === 'sleeping' && (
          <>
            <line x1="39" y1="34" x2="47" y2="34" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="53" y1="34" x2="61" y2="34" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
            <text x="62" y="25" fontSize="10" fill="#999">z</text>
            <text x="68" y="18" fontSize="7" fill="#999">z</text>
          </>
        )}
      </svg>
    </motion.div>
  );
}
