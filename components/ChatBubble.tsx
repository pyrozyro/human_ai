'use client';

import { motion } from 'framer-motion';
import type { ChatMessage } from '@/types';
import ThinkingStatus from './ThinkingStatus';
import CountdownBar from './CountdownBar';

interface ChatBubbleProps {
  message: ChatMessage;
  onExpire?: (id: string) => void;
}

export default function ChatBubble({ message, onExpire }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isPending = message.status === 'pending' || message.status === 'claiming';
  const isExpired = message.status === 'expired';
  const isAnswered = message.status === 'answered';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex items-end gap-2 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#0F3460] flex items-center justify-center text-lg flex-shrink-0 mb-1">
          🤖
        </div>
      )}

      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bubble-user bg-[#FF6B35] text-white rounded-br-sm'
              : 'bubble-ai bg-[#0F3460] text-white rounded-bl-sm'
          }`}
        >
          {isUser && <p>{message.content}</p>}

          {!isUser && isAnswered && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {message.content}
            </motion.p>
          )}

          {!isUser && isPending && (
            <div className="space-y-3">
              <ThinkingStatus />
              <CountdownBar
                duration={30}
                questionId={message.questionId!}
                onExpire={() => onExpire?.(message.id)}
              />
            </div>
          )}

          {!isUser && isExpired && (
            <p className="text-gray-400 italic">{message.content}</p>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-gray-500 px-1">
          {new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}
