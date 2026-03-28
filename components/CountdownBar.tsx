'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface CountdownBarProps {
  duration: number; // seconds
  questionId: string;
  onExpire: () => void;
}

export default function CountdownBar({ duration, onExpire }: CountdownBarProps) {
  const [remaining, setRemaining] = useState(duration);
  const called = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!called.current) {
            called.current = true;
            onExpire();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const percentage = (remaining / duration) * 100;
  const isCritical = remaining <= 5;

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-gray-400">Masa menunggu</span>
        <span
          className={`text-[10px] font-bold ${
            isCritical ? 'text-red-400 animate-pulse' : 'text-yellow-400'
          }`}
        >
          {remaining}s
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${isCritical ? 'bg-red-500' : 'progress-shimmer'}`}
          style={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'linear' }}
        />
      </div>
    </div>
  );
}
