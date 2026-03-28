'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Clock, Zap } from 'lucide-react';
import type { Question } from '@/types';

interface QuestionCardProps {
  question: Question;
  onClaim: (question: Question) => void;
  isNew?: boolean;
}

export default function QuestionCard({ question, onClaim, isNew = false }: QuestionCardProps) {
  const ageSeconds = Math.floor(
    (Date.now() - new Date(question.created_at).getTime()) / 1000
  );

  const ageLabel =
    ageSeconds < 60
      ? `${ageSeconds}s yang lalu`
      : `${Math.floor(ageSeconds / 60)}m yang lalu`;

  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: -20, scale: 0.95 } : { opacity: 1 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={{ scale: 1.01 }}
      className={`relative bg-[#16213E] border rounded-xl p-4 cursor-pointer transition-colors group ${
        isNew
          ? 'border-yellow-400/60 glow-yellow'
          : 'border-white/10 hover:border-yellow-400/40'
      }`}
      onClick={() => onClaim(question)}
    >
      {isNew && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded-full"
        >
          BARU!
        </motion.div>
      )}

      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-[#0F3460] rounded-full flex items-center justify-center flex-shrink-0">
          <MessageSquare size={14} className="text-yellow-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm leading-relaxed line-clamp-3">
            {question.content}
          </p>

          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Clock size={10} />
              {ageLabel}
            </span>
            <span className="text-[11px] text-yellow-400 font-medium flex items-center gap-1">
              <Zap size={10} />
              +10 XP
            </span>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex-shrink-0 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onClaim(question);
          }}
        >
          Jawab!
        </motion.button>
      </div>
    </motion.div>
  );
}
