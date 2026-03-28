'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Zap, Clock, Pen, Type, Trash2 } from 'lucide-react';
import type { Question } from '@/types';

interface AnswerModalProps {
  question: Question;
  onSubmit: (answer: string, responseTime: number) => void;
  onExpire: () => void;
}

type Mode = 'text' | 'draw';

const COLORS = ['#FFFFFF', '#FFD700', '#FF6B6B', '#6BCB77', '#4D96FF', '#FF6B35'];

export default function AnswerModal({ question, onSubmit, onExpire }: AnswerModalProps) {
  const [mode, setMode] = useState<Mode>('text');
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [penColor, setPenColor] = useState('#FFFFFF');
  const [penSize, setPenSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const startTime = useRef(Date.now());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (mode === 'text') textareaRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (mode === 'draw' && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [mode]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    setIsDrawing(true);
    setHasDrawing(true);
    lastPos.current = getPos(e, canvasRef.current);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !canvasRef.current || !lastPos.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvasRef.current);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  }, [isDrawing, penColor, penSize]);

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
    lastPos.current = null;
  }, []);

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasDrawing(false);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    let content = '';
    if (mode === 'text') {
      if (!answer.trim()) return;
      content = answer.trim();
    } else {
      if (!hasDrawing || !canvasRef.current) return;
      content = canvasRef.current.toDataURL('image/png');
    }
    setIsSubmitting(true);
    const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
    onSubmit(content, elapsed);
  };

  const isCritical = timeLeft <= 5;
  const percentage = (timeLeft / 30) * 100;
  const canSubmit = mode === 'text' ? answer.trim().length > 0 : hasDrawing;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{
          scale: 1, opacity: 1, y: 0,
          x: isCritical ? [0, -6, 6, -6, 6, 0] : 0,
        }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{
          duration: 0.3,
          x: isCritical ? { duration: 0.3, repeat: Infinity } : {},
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
            onClick={onExpire}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Timer */}
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Clock size={10} /> Masa tinggal
            </span>
            <span className={`text-sm font-bold ${isCritical ? 'text-red-400' : 'text-yellow-400'}`}>
              {timeLeft}s
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isCritical ? 'bg-red-500' : 'bg-yellow-400'}`}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="px-4 pt-3">
          <div className="bg-[#0F3460] rounded-xl p-3 mb-3">
            <p className="text-[11px] text-gray-400 mb-1">Soalan dari pengguna:</p>
            <p className="text-white text-sm leading-relaxed">{question.content}</p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="px-4 mb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('text')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mode === 'text' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <Type size={12} /> Taip
            </button>
            <button
              onClick={() => setMode('draw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mode === 'draw' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <Pen size={12} /> Lukis
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="px-4">
          {mode === 'text' ? (
            <>
              <textarea
                ref={textareaRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Taip jawapan kau di sini... Buat macam AI, nak?"
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm resize-none focus:outline-none focus:border-yellow-400/50 placeholder-gray-500 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
                }}
              />
              <p className="text-[10px] text-gray-500 mt-1">Ctrl+Enter untuk hantar</p>
            </>
          ) : (
            <div className="space-y-2">
              {/* Color + size toolbar */}
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setPenColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition-transform ${
                        penColor === c ? 'border-white scale-125' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5 ml-auto items-center">
                  {[2, 4, 8].map((s) => (
                    <button
                      key={s}
                      onClick={() => setPenSize(s)}
                      className={`rounded-full bg-white transition-transform ${penSize === s ? 'scale-125' : 'opacity-50'}`}
                      style={{ width: s * 2.5, height: s * 2.5 }}
                    />
                  ))}
                  <button
                    onClick={clearCanvas}
                    className="ml-2 p-1 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Canvas */}
              <canvas
                ref={canvasRef}
                width={480}
                height={220}
                className="w-full rounded-xl border border-white/10 cursor-crosshair touch-none"
                style={{ background: '#1a1a2e' }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
              {!hasDrawing && (
                <p className="text-[10px] text-gray-500 text-center">Mula lukis di sini...</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-yellow-400">
            <Zap size={12} />
            <span>+10 XP{timeLeft > 20 && <span className="text-green-400 ml-1">+5 BONUS jika laju!</span>}</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <><Send size={14} /> Hantar Jawapan</>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
