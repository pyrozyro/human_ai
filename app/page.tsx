'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, Users } from 'lucide-react';
import Link from 'next/link';
import type { ChatMessage, QuestionStatus } from '@/types';
import { supabase, submitQuestion } from '@/lib/supabase';
import { EXPIRED_MESSAGES } from '@/lib/xp';
import ChatBubble from '@/components/ChatBubble';
import ChickenMascot from '@/components/ChickenMascot';

type MascotMood = 'idle' | 'thinking' | 'happy' | 'shocked' | 'sleeping';

function getRandomExpiredMsg() {
  return EXPIRED_MESSAGES[Math.floor(Math.random() * EXPIRED_MESSAGES.length)];
}

export default function AskerPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mascotMood, setMascotMood] = useState<MascotMood>('idle');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Track active subscriptions per questionId
  const subscriptions = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptions.current.forEach((sub) => supabase.removeChannel(sub));
    };
  }, []);

  const handleExpire = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, status: 'expired' as QuestionStatus, content: getRandomExpiredMsg() }
          : m
      )
    );
    setMascotMood('sleeping');
    setTimeout(() => setMascotMood('idle'), 3000);
  }, []);

  const subscribeToQuestion = useCallback(
    (questionId: string, messageId: string) => {
      const channel = supabase
        .channel(`question-${questionId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'questions',
            filter: `id=eq.${questionId}`,
          },
          (payload) => {
            const updated = payload.new as {
              status: QuestionStatus;
              answer_content: string | null;
            };

            if (updated.status === 'answered' && updated.answer_content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        status: 'answered',
                        content: updated.answer_content!,
                        role: 'ai',
                      }
                    : m
                )
              );
              setMascotMood('happy');
              setTimeout(() => setMascotMood('idle'), 3000);

              // Unsubscribe after answer received
              const sub = subscriptions.current.get(questionId);
              if (sub) {
                supabase.removeChannel(sub);
                subscriptions.current.delete(questionId);
              }
            } else if (updated.status === 'expired') {
              handleExpire(messageId);
              const sub = subscriptions.current.get(questionId);
              if (sub) {
                supabase.removeChannel(sub);
                subscriptions.current.delete(questionId);
              }
            }
          }
        )
        .subscribe();

      subscriptions.current.set(questionId, channel);
    },
    [handleExpire]
  );

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isLoading) return;

    setInput('');
    setIsLoading(true);
    setMascotMood('thinking');

    // Optimistically add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };
    setMessages((prev) => [...prev, userMsg]);

    // Create AI placeholder
    const aiMsgId = crypto.randomUUID();

    // Submit to Supabase
    const question = await submitQuestion(content);

    if (!question) {
      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: 'ai',
          content: 'Eh, ada error la pulak. Cuba lagi.',
          status: 'expired',
        },
      ]);
      setMascotMood('shocked');
      setTimeout(() => setMascotMood('idle'), 2000);
      setIsLoading(false);
      return;
    }

    // Add AI thinking bubble
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'ai',
      content: '',
      status: 'pending',
      questionId: question.id,
    };
    setMessages((prev) => [...prev, aiMsg]);
    setIsLoading(false);

    // Subscribe to realtime updates for this question
    subscribeToQuestion(question.id, aiMsgId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const pendingCount = messages.filter(
    (m) => m.role === 'ai' && (m.status === 'pending' || m.status === 'claiming')
  ).length;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10 bg-[#16213E]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#0F3460] rounded-full flex items-center justify-center">
              <Bot size={18} className="text-yellow-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">AI-Manusia</h1>
              <p className="text-[11px] text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                Online • Bukan bot (mungkin)
              </p>
            </div>
          </div>

          <Link
            href="/hub"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-yellow-400 transition-colors border border-white/10 hover:border-yellow-400/30 px-3 py-1.5 rounded-lg"
          >
            <Users size={13} />
            Jadi Responder
          </Link>
        </div>
      </div>

      {/* Mascot + Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {/* Welcome state */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full gap-4 text-center"
          >
            <ChickenMascot mood={mascotMood} size={100} />
            <div>
              <h2 className="text-xl font-bold text-yellow-400">Helo! Saya AI.</h2>
              <p className="text-sm text-gray-400 mt-1">
                Tanya apa sahaja. Saya akan jawab dengan... kecerdasan buatan.
              </p>
              <p className="text-xs text-gray-600 mt-1 italic">*(atau tidak)</p>
            </div>

            {/* Sample questions */}
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                'Kenapa langit biru?',
                'Apa rahsia bahagia?',
                'Bila nak kahwin?',
                'Kenapa nasi lemak sedap?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    inputRef.current?.focus();
                  }}
                  className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-400/30 px-3 py-1.5 rounded-full transition-colors text-gray-300 hover:text-white"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <>
            {/* Floating mascot when there are messages */}
            <div className="flex justify-center mb-2">
              <ChickenMascot mood={mascotMood} size={50} />
            </div>

            <AnimatePresence>
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  onExpire={handleExpire}
                />
              ))}
            </AnimatePresence>
          </>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Pending indicator */}
      <AnimatePresence>
        {pendingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex-shrink-0 mx-4 mb-2"
          >
            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <div className="flex gap-1">
                <div className="typing-dot w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                <div className="typing-dot w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                <div className="typing-dot w-1.5 h-1.5 bg-yellow-400 rounded-full" />
              </div>
              <span className="text-xs text-yellow-400">
                AI sedang memproses {pendingCount} soalan...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-white/10 bg-[#16213E]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanya AI apa sahaja..."
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 focus:border-yellow-400/40 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none transition-colors max-h-32"
            style={{
              height: 'auto',
              minHeight: '44px',
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 128) + 'px';
            }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 flex-shrink-0 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Send size={16} className="text-black" />
            )}
          </motion.button>
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 text-center">
          Enter untuk hantar • Shift+Enter untuk baris baru
        </p>
      </div>
    </div>
  );
}
