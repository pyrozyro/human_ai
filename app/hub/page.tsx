'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Trophy, Bell, BellOff, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Question } from '@/types';
import { supabase, claimQuestion, fetchPendingQuestions, submitAnswer } from '@/lib/supabase';
import { getLevel } from '@/lib/xp';
import QuestionCard from '@/components/QuestionCard';
import AnswerModal from '@/components/AnswerModal';

const ANON_NAMES = [
  'Ninja Zul', 'Pendekar Farid', 'Wira Hafiz', 'Pahlawan Din',
  'Tuan Guru Mat', 'Si Bijak Ali', 'Cikgu Rashid', 'Bomoh Handal',
  'Tok Dalang', 'Abang Google', 'Encik Wikipedia', 'Master Lan',
];

function getOrCreateSession() {
  if (typeof window === 'undefined') return { username: 'Anonymous', xp: 0 };
  const stored = localStorage.getItem('ai_manusia_session');
  if (stored) return JSON.parse(stored);
  const session = {
    username: ANON_NAMES[Math.floor(Math.random() * ANON_NAMES.length)],
    xp: 0,
  };
  localStorage.setItem('ai_manusia_session', JSON.stringify(session));
  return session;
}

function saveXP(xp: number) {
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem('ai_manusia_session');
  if (stored) {
    const session = JSON.parse(stored);
    session.xp = xp;
    localStorage.setItem('ai_manusia_session', JSON.stringify(session));
  }
}

interface XPToast {
  id: string;
  xpEarned: number;
  newXP: number;
  level: string;
}

export default function HubPage() {
  const [session, setSession] = useState<{ username: string; xp: number } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestionIds, setNewQuestionIds] = useState<Set<string>>(new Set());
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [xpToasts, setXPToasts] = useState<XPToast[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [claimError, setClaimError] = useState('');
  const audioRef = useRef<AudioContext | null>(null);

  const playPop = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }, [soundEnabled]);

  // Init session
  useEffect(() => {
    setSession(getOrCreateSession());
  }, []);

  // Load questions
  useEffect(() => {
    fetchPendingQuestions().then(setQuestions);
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('hub-questions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newQ = payload.new as Question;
          if (newQ.status === 'pending') {
            setQuestions((prev) => [newQ, ...prev]);
            setNewQuestionIds((prev) => new Set([...prev, newQ.id]));
            playPop();
            setTimeout(() => {
              setNewQuestionIds((prev) => {
                const next = new Set(prev);
                next.delete(newQ.id);
                return next;
              });
            }, 5000);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Question;
          if (updated.status !== 'pending') {
            setQuestions((prev) => prev.filter((q) => q.id !== updated.id));
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [playPop]);

  const handleClaim = async (question: Question) => {
    setClaimError('');
    const success = await claimQuestion(question.id, null);
    if (!success) {
      setClaimError('Alah! Orang lain dah kebas soalan ni!');
      setTimeout(() => setClaimError(''), 3000);
      return;
    }
    setActiveQuestion(question);
    setQuestions((prev) => prev.filter((q) => q.id !== question.id));
  };

  const handleSubmitAnswer = async (answer: string, responseTime: number) => {
    if (!activeQuestion || !session) return;

    const result = await submitAnswer(activeQuestion.id, answer, responseTime);
    setActiveQuestion(null);

    const xpEarned = responseTime < 10 ? 15 : 10;
    const newXP = session.xp + xpEarned;
    const newLevel = getLevel(newXP);
    const updatedSession = { ...session, xp: newXP };
    setSession(updatedSession);
    saveXP(newXP);

    const toastId = crypto.randomUUID();
    setXPToasts((prev) => [...prev, { id: toastId, xpEarned, newXP, level: newLevel }]);
    setTimeout(() => {
      setXPToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 3000);
  };

  const handleExpire = () => {
    setActiveQuestion(null);
    setClaimError('Masa habis! Soalan dah expired.');
    setTimeout(() => setClaimError(''), 3000);
  };

  if (!session) return null;

  const level = getLevel(session.xp);

  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#161B22] border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <p className="text-sm font-bold text-white">{session.username}</p>
              <p className="text-[11px] text-yellow-400">{level} • {session.xp} XP</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              {soundEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            </button>
            <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 px-3 py-1.5 rounded-lg">
              <Trophy size={13} className="text-yellow-400" />
              <span className="text-xs text-yellow-400 font-bold">{session.xp} XP</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Claim error toast */}
        <AnimatePresence>
          {claimError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 bg-red-500/20 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl"
            >
              {claimError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* XP Toasts */}
        <div className="fixed top-20 right-4 z-50 space-y-2">
          <AnimatePresence>
            {xpToasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="bg-yellow-400 text-black px-4 py-2 rounded-xl shadow-lg"
              >
                <p className="text-sm font-bold">+{toast.xpEarned} XP!</p>
                <p className="text-xs">{toast.level}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Question count */}
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} className="text-yellow-400" />
          <span className="text-sm text-gray-400">
            {questions.length} soalan menunggu jawapan
          </span>
        </div>

        {/* Questions */}
        {questions.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-4xl mb-3">😴</p>
            <p className="text-sm">Takde soalan lagi. Tunggu sekejap...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  isNew={newQuestionIds.has(q.id)}
                  onClaim={() => handleClaim(q)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Answer Modal */}
      <AnimatePresence>
        {activeQuestion && (
          <AnswerModal
            question={activeQuestion}
            onSubmit={handleSubmitAnswer}
            onExpire={handleExpire}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
