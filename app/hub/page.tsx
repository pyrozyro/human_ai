'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, LogOut, Trophy, RefreshCw, Bell, BellOff, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Question, Profile } from '@/types';
import {
  supabase,
  claimQuestion,
  fetchPendingQuestions,
  fetchProfile,
  signIn,
  signUp,
  signOut,
} from '@/lib/supabase';
import { getXPToNextLevel } from '@/lib/xp';
import QuestionCard from '@/components/QuestionCard';
import AnswerModal from '@/components/AnswerModal';

type AuthMode = 'login' | 'register';

interface XPToast {
  id: string;
  xpEarned: number;
  newXP: number;
  level: string;
}

export default function HubPage() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestionIds, setNewQuestionIds] = useState<Set<string>>(new Set());
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [xpToasts, setXPToasts] = useState<XPToast[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [claimError, setClaimError] = useState('');
  const audioRef = useRef<AudioContext | null>(null);

  // Play pop sound using Web Audio API (no file needed)
  const playPop = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new AudioContext();
      }
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
    } catch {
      // Audio not supported
    }
  }, [soundEnabled]);

  // Load session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser({ id: data.session.user.id, email: data.session.user.email! });
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! });
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Load profile & questions when logged in
  useEffect(() => {
    if (!user) return;
    fetchProfile(user.id).then(setProfile);
    fetchPendingQuestions().then(setQuestions);
  }, [user]);

  // Realtime subscription for hub
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('hub-questions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'questions' },
        (payload) => {
          const newQ = payload.new as Question;
          if (newQ.status === 'pending') {
            setQuestions((prev) => [newQ, ...prev]);
            setNewQuestionIds((prev) => new Set([...prev, newQ.id]));
            playPop();
            // Remove "new" badge after 5s
            setTimeout(() => {
              setNewQuestionIds((prev) => {
                const next = new Set(prev);
                next.delete(newQ.id);
                return next;
              });
            }, 5000);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'questions' },
        (payload) => {
          const updated = payload.new as Question;
          setQuestions((prev) => {
            if (updated.status !== 'pending') {
              return prev.filter((q) => q.id !== updated.id);
            }
            return prev.map((q) => (q.id === updated.id ? updated : q));
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, playPop]);

  const handleClaim = async (question: Question) => {
    if (!user) return;
    setClaimError('');

    const success = await claimQuestion(question.id, user.id);

    if (!success) {
      setClaimError('Alah! Orang lain dah kebas soalan ni!');
      setTimeout(() => setClaimError(''), 3000);
      return;
    }

    // Remove from list & open modal
    setQuestions((prev) => prev.filter((q) => q.id !== question.id));
    setActiveQuestion({ ...question, status: 'claiming', responder_id: user.id });
  };

  const handleAnswerSubmitted = (xpEarned: number, newXP: number, level: string) => {
    setActiveQuestion(null);

    // Update local profile
    setProfile((prev) => prev ? { ...prev, xp: newXP, level } : prev);

    // Show XP toast
    const toast: XPToast = { id: crypto.randomUUID(), xpEarned, newXP, level };
    setXPToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setXPToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 4000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    if (authMode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setAuthError('Email atau password salah. Cuba lagi.');
    } else {
      if (!username.trim()) {
        setAuthError('Username wajib diisi!');
        setIsAuthLoading(false);
        return;
      }
      const { error } = await signUp(email, password, username);
      if (error) setAuthError(error.message);
      else setAuthError('Semak email untuk verify akaun!');
    }

    setIsAuthLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setQuestions([]);
  };

  // XP progress bar
  const xpProgress = profile ? getXPToNextLevel(profile.xp) : null;

  // ─── AUTH WALL ───────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🤖</div>
            <h1 className="text-2xl font-bold text-yellow-400">Jadi AI-Manusia</h1>
            <p className="text-sm text-gray-400 mt-1">
              Login untuk jadi Responder dan kumpul XP!
            </p>
          </div>

          <div className="bg-[#16213E] rounded-2xl p-6 border border-white/10">
            {/* Tab switcher */}
            <div className="flex bg-white/5 rounded-xl p-1 mb-5">
              {(['login', 'register'] as AuthMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setAuthMode(mode); setAuthError(''); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                    authMode === mode
                      ? 'bg-yellow-400 text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {mode === 'login' ? 'Log Masuk' : 'Daftar'}
                </button>
              ))}
            </div>

            <form onSubmit={handleAuth} className="space-y-3">
              {authMode === 'register' && (
                <input
                  type="text"
                  placeholder="Username (nama AI kau)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-yellow-400/40 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 focus:border-yellow-400/40 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 focus:border-yellow-400/40 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
              />

              {authError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg"
                >
                  {authError}
                </motion.p>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isAuthLoading}
                className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-600 text-black font-bold py-3 rounded-xl transition-colors"
              >
                {isAuthLoading ? 'Loading...' : authMode === 'login' ? 'Log Masuk' : 'Daftar Sekarang'}
              </motion.button>
            </form>
          </div>

          <Link
            href="/"
            className="flex items-center justify-center gap-2 text-gray-500 hover:text-white text-sm mt-4 transition-colors"
          >
            <ArrowLeft size={14} />
            Balik ke chat
          </Link>
        </motion.div>
      </div>
    );
  }

  // ─── RESPONDER HUB ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10 bg-[#16213E] sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>

          <h1 className="text-sm font-bold text-white">Responder Hub</h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              {soundEnabled ? <Bell size={14} /> : <BellOff size={14} />}
            </button>
            <button
              onClick={() => fetchPendingQuestions().then(setQuestions)}
              className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={handleSignOut}
              className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* Profile bar */}
        {profile && (
          <div className="mt-3 bg-[#0F3460] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-bold text-white">{profile.username}</p>
                <p className="text-xs text-yellow-400">{profile.level}</p>
              </div>
              <div className="flex items-center gap-1 bg-yellow-400/10 px-3 py-1 rounded-full">
                <Zap size={12} className="text-yellow-400" />
                <span className="text-sm font-bold text-yellow-400">{profile.xp} XP</span>
              </div>
            </div>

            {xpProgress && xpProgress.max !== Infinity && (
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>Menuju {xpProgress.label}</span>
                  <span>{xpProgress.current}/{xpProgress.max}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full progress-shimmer rounded-full"
                    animate={{
                      width: `${Math.min((xpProgress.current / xpProgress.max) * 100, 100)}%`,
                    }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}

            {profile.level === 'Professor AI 🧠' && (
              <div className="flex items-center gap-1 mt-1">
                <Trophy size={12} className="text-yellow-400" />
                <span className="text-[11px] text-yellow-400 font-medium">
                  Max Level! Kau memang legend.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Claim error toast */}
      <AnimatePresence>
        {claimError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-3 bg-red-500/20 border border-red-500/30 text-red-400 text-sm px-4 py-2.5 rounded-xl text-center"
          >
            {claimError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Questions feed */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Soalan Menunggu Jawapan
          </h2>
          <span className="text-xs bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded-full font-medium">
            {questions.length} soalan
          </span>
        </div>

        {questions.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="text-5xl mb-3">😴</div>
            <p className="text-gray-400 text-sm">Takde soalan lagi...</p>
            <p className="text-gray-600 text-xs mt-1">Tunggu je, dia akan datang.</p>
          </motion.div>
        )}

        <AnimatePresence>
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              onClaim={handleClaim}
              isNew={newQuestionIds.has(q.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Answer Modal */}
      <AnimatePresence>
        {activeQuestion && (
          <AnswerModal
            question={activeQuestion}
            onClose={() => setActiveQuestion(null)}
            onSubmitted={handleAnswerSubmitted}
          />
        )}
      </AnimatePresence>

      {/* XP Toasts */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        <AnimatePresence>
          {xpToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="bg-yellow-400 text-black px-4 py-3 rounded-xl shadow-xl"
            >
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-black" />
                <div>
                  <p className="text-sm font-bold">+{toast.xpEarned} XP!</p>
                  <p className="text-xs opacity-70">{toast.level} • {toast.newXP} XP total</p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
