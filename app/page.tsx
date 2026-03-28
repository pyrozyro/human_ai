'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Zap, Trophy, Bell, BellOff, Pen, MessageSquare } from 'lucide-react';
import type { ChatMessage, QuestionStatus, Question } from '@/types';
import { supabase, submitQuestion, claimQuestion, fetchPendingQuestions, submitAnswer } from '@/lib/supabase';
import { EXPIRED_MESSAGES, getLevel } from '@/lib/xp';
import ChatBubble from '@/components/ChatBubble';
import ChickenMascot from '@/components/ChickenMascot';
import QuestionCard from '@/components/QuestionCard';
import AnswerModal from '@/components/AnswerModal';

type MascotMood = 'idle' | 'thinking' | 'happy' | 'shocked' | 'sleeping';
type MobileTab = 'chat' | 'feed';

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
    const s = JSON.parse(stored);
    s.xp = xp;
    localStorage.setItem('ai_manusia_session', JSON.stringify(s));
  }
}

export default function MainPage() {
  // Asker state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mascotMood, setMascotMood] = useState<MascotMood>('idle');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const subscriptions = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());

  // Responder state
  const [session, setSession] = useState<{ username: string; xp: number } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestionIds, setNewQuestionIds] = useState<Set<string>>(new Set());
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [claimError, setClaimError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [xpToast, setXpToast] = useState<{ xp: number; level: string } | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');
  const audioRef = useRef<AudioContext | null>(null);

  // Init session
  useEffect(() => { setSession(getOrCreateSession()); }, []);

  // Scroll to bottom
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Cleanup asker subscriptions
  useEffect(() => {
    return () => { subscriptions.current.forEach((sub) => supabase.removeChannel(sub)); };
  }, []);

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

  // Load + subscribe to questions feed
  useEffect(() => {
    fetchPendingQuestions().then(setQuestions);

    const channel = supabase
      .channel('feed-questions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newQ = payload.new as Question;
          if (newQ.status === 'pending') {
            setQuestions((prev) => [newQ, ...prev]);
            setNewQuestionIds((prev) => new Set([...prev, newQ.id]));
            playPop();
            setTimeout(() => {
              setNewQuestionIds((prev) => { const n = new Set(prev); n.delete(newQ.id); return n; });
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

  // Asker: expire handler
  const handleExpire = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, status: 'expired' as QuestionStatus, content: EXPIRED_MESSAGES[Math.floor(Math.random() * EXPIRED_MESSAGES.length)] }
          : m
      )
    );
    setMascotMood('sleeping');
    setTimeout(() => setMascotMood('idle'), 3000);
  }, []);

  // Asker: subscribe to question updates
  const subscribeToQuestion = useCallback((questionId: string, messageId: string) => {
    const channel = supabase
      .channel(`question-${questionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'questions', filter: `id=eq.${questionId}` },
        (payload) => {
          const updated = payload.new as { status: QuestionStatus; answer_content: string | null };
          if (updated.status === 'answered' && updated.answer_content) {
            setMessages((prev) =>
              prev.map((m) => m.id === messageId
                ? { ...m, status: 'answered', content: updated.answer_content!, role: 'ai' }
                : m
              )
            );
            setMascotMood('happy');
            setTimeout(() => setMascotMood('idle'), 3000);
            const sub = subscriptions.current.get(questionId);
            if (sub) { supabase.removeChannel(sub); subscriptions.current.delete(questionId); }
          } else if (updated.status === 'expired') {
            handleExpire(messageId);
            const sub = subscriptions.current.get(questionId);
            if (sub) { supabase.removeChannel(sub); subscriptions.current.delete(questionId); }
          }
        }
      ).subscribe();
    subscriptions.current.set(questionId, channel);
  }, [handleExpire]);

  // Asker: send question
  const handleSend = async () => {
    const content = input.trim();
    if (!content || isLoading) return;
    setInput('');
    setIsLoading(true);
    setMascotMood('thinking');

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);

    const aiMsgId = crypto.randomUUID();
    const question = await submitQuestion(content);

    if (!question) {
      setMessages((prev) => [...prev, { id: aiMsgId, role: 'ai', content: 'Eh, ada error la pulak. Cuba lagi.', status: 'expired' }]);
      setMascotMood('shocked');
      setTimeout(() => setMascotMood('idle'), 2000);
      setIsLoading(false);
      return;
    }

    setMessages((prev) => [...prev, { id: aiMsgId, role: 'ai', content: '', status: 'pending', questionId: question.id }]);
    setIsLoading(false);
    subscribeToQuestion(question.id, aiMsgId);
  };

  // Responder: claim question
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

  // Responder: submit answer
  const handleSubmitAnswer = async (answer: string, responseTime: number) => {
    if (!activeQuestion || !session) return;
    await submitAnswer(activeQuestion.id, answer, responseTime);
    setActiveQuestion(null);

    const xpEarned = responseTime < 10 ? 15 : 10;
    const newXP = session.xp + xpEarned;
    const newLevel = getLevel(newXP);
    const updated = { ...session, xp: newXP };
    setSession(updated);
    saveXP(newXP);
    setXpToast({ xp: xpEarned, level: newLevel });
    setTimeout(() => setXpToast(null), 3000);
  };

  const pendingCount = messages.filter((m) => m.role === 'ai' && (m.status === 'pending' || m.status === 'claiming')).length;

  return (
    <div className="flex flex-col h-screen bg-[#0D1117] text-white overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#161B22]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#0F3460] rounded-full flex items-center justify-center">
            <span className="text-sm">🤖</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">AI-Manusia</h1>
            <p className="text-[10px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
              Online • Bukan bot (mungkin)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session && (
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-400">
              <span className="text-yellow-400 font-medium">{session.username}</span>
              <span className="text-gray-600">•</span>
              <Trophy size={11} className="text-yellow-400" />
              <span className="text-yellow-400">{session.xp} XP</span>
            </div>
          )}
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 text-gray-500 hover:text-white transition-colors">
            {soundEnabled ? <Bell size={14} /> : <BellOff size={14} />}
          </button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex sm:hidden border-b border-white/10 bg-[#161B22]">
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${mobileTab === 'chat' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500'}`}
        >
          <MessageSquare size={13} /> Chat
        </button>
        <button
          onClick={() => setMobileTab('feed')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${mobileTab === 'feed' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500'}`}
        >
          <Zap size={13} /> Soalan {questions.length > 0 && <span className="bg-yellow-400 text-black rounded-full px-1.5 text-[10px] font-bold">{questions.length}</span>}
        </button>
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Chat panel */}
        <div className={`flex flex-col ${mobileTab === 'feed' ? 'hidden' : 'flex'} sm:flex flex-1 border-r border-white/10`}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full gap-4 text-center"
              >
                <ChickenMascot mood={mascotMood} size={90} />
                <div>
                  <h2 className="text-xl font-bold text-yellow-400">Helo! Saya AI.</h2>
                  <p className="text-sm text-gray-400 mt-1">Tanya apa sahaja. Saya akan jawab dengan... kecerdasan buatan.</p>
                  <p className="text-xs text-gray-600 mt-1 italic">*(atau tidak)</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  {['Kenapa langit biru?', 'Apa rahsia bahagia?', 'Bila nak kahwin?', 'Generate gambar nasi lemak'].map((q) => (
                    <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-400/30 px-3 py-1.5 rounded-full transition-colors text-gray-300 hover:text-white">
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <>
                <div className="flex justify-center mb-3">
                  <ChickenMascot mood={mascotMood} size={45} />
                </div>
                <AnimatePresence>
                  {messages.map((msg) => (
                    <ChatBubble key={msg.id} message={msg} onExpire={handleExpire} />
                  ))}
                </AnimatePresence>
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Pending indicator */}
          <AnimatePresence>
            {pendingCount > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="mx-4 mb-2 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <span className="text-xs text-yellow-400">AI sedang memproses...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="flex-shrink-0 p-4 border-t border-white/10 bg-[#161B22]">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Tanya AI apa sahaja..."
                rows={1}
                className="flex-1 bg-white/5 border border-white/10 focus:border-yellow-400/40 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none transition-colors"
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 128) + 'px';
                }}
              />
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-11 h-11 flex-shrink-0 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors"
              >
                {isLoading
                  ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  : <Send size={16} className="text-black" />
                }
              </motion.button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5 text-center">Enter untuk hantar • Shift+Enter untuk baris baru</p>
          </div>
        </div>

        {/* RIGHT: Question feed */}
        <div className={`${mobileTab === 'chat' ? 'hidden' : 'flex'} sm:flex flex-col w-full sm:w-80 lg:w-96 bg-[#0D1117]`}>
          {/* Feed header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-white/10 bg-[#161B22]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-yellow-400" />
                <span className="text-sm font-semibold text-white">Live Soalan</span>
              </div>
              <span className="text-[11px] bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded-full">
                {questions.length} pending
              </span>
            </div>
            {claimError && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-xs text-red-400 mt-2">
                {claimError}
              </motion.p>
            )}
          </div>

          {/* Question list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-600 gap-2">
                <span className="text-3xl">😴</span>
                <p className="text-xs">Takde soalan lagi.<br />Tunggu ada orang tanya...</p>
              </div>
            ) : (
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
            )}
          </div>

          {/* Responder info */}
          {session && (
            <div className="flex-shrink-0 px-4 py-2.5 border-t border-white/10 bg-[#161B22]">
              <div className="flex items-center gap-2">
                <Pen size={11} className="text-gray-500" />
                <span className="text-[11px] text-gray-500">
                  Kau: <span className="text-yellow-400">{session.username}</span> • <span className="text-yellow-400">{session.xp} XP</span> • {getLevel(session.xp)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* XP toast */}
      <AnimatePresence>
        {xpToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-24 left-1/2 bg-yellow-400 text-black px-4 py-2 rounded-xl shadow-lg z-50"
          >
            <p className="text-sm font-bold text-center">+{xpToast.xp} XP! {xpToast.level}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Answer Modal */}
      <AnimatePresence>
        {activeQuestion && (
          <AnswerModal
            question={activeQuestion}
            onSubmit={handleSubmitAnswer}
            onExpire={() => { setActiveQuestion(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
