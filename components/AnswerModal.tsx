'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Zap, Clock } from 'lucide-react';
import type { Question } from '@/types';
import { submitAnswer } from '@/lib/supabase';

interface AnswerModalProps {
  question: Question;
  onClose: () => void;
  onSubmitted: (xpEarned: number, newXP: number, level: string) => void;
}

export default function AnswerModal({ question, onClose, onSubmitted }: AnswerModalProps) {
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startTime = useRef(Date.now());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!answer.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
    const result = await submitAnswer(question.id, answer.trim(), elapsed);

    if (result?.success) {
      onSubmitted(result.xp_earned, result.new_xp, result.level);
    } else {
      onClose();
    }
  };

  const isShaking = timeLeft <= 5;
  const percentage = (timeLeft / 30) * 100;
  const isCritical = timeLeft <= 5;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{
            scale: 1,
            opacity: 1,
            y: 0,
            x: isShaking ? [0, -6, 6, -6, 6, 0] : 0,
          }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{
            duration: isShaking ? 0.3 : 0.3,
            x: isShaking ? { duration: 0.3, repeat: Infinity, repeatType: 'loop' } : {},
          }}
          className="bg-[#16213E] rounded-2xl border border-white/10 w-full max-w-lg overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <div>
                <p className="text-sm font-semibold text-white">Jawab Soalan</p>
                <p className="text-[11px] text-gray-400">Kau AI sekarang. Jangan malu.</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Timer bar */}
          <div className="px-4 pt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Clock size={10} />
                Masa tinggal
              </span>
              <span
                className={`text-sm font-bold ${
                  isCritical ? 'text-red-400' : 'text-yellow-400'
                }`}
              >
                {timeLeft}s
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full transition-colors ${
                  isCritical ? 'bg-red-500' : 'bg-yellow-400'
                }`}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="p-4">
            <div className="bg-[#0F3460] rounded-xl p-3 mb-3">
              <p className="text-[11px] text-gray-400 mb-1">Soalan dari pengguna:</p>
              <p className="text-white text-sm leading-relaxed">{question.content}</p>
            </div>

            {/* Answer textarea */}
            <textarea
              ref={textareaRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Taip jawapan kau di sini... Buat macam AI, nak?"
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm resize-none focus:outline-none focus:border-yellow-400/50 placeholder-gray-500 transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSubmit();
                }
              }}
            />
            <p className="text-[10px] text-gray-500 mt-1">Ctrl+Enter untuk hantar</p>
          </div>

          {/* Footer */}
          <div className="p-4 pt-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-yellow-400">
              <Zap size={12} />
              <span>
                +10 XP
                {timeLeft > 20 && <span className="text-green-400 ml-1">+5 BONUS jika laju!</span>}
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={!answer.trim() || isSubmitting}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Menghantar...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Hantar Jawapan
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
