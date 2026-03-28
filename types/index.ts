export type QuestionStatus = 'pending' | 'claiming' | 'answered' | 'expired';

export interface Profile {
  id: string;
  username: string;
  xp: number;
  level: string;
  created_at: string;
}

export interface Question {
  id: string;
  content: string;
  status: QuestionStatus;
  asker_id: string | null;
  responder_id: string | null;
  answer_content: string | null;
  created_at: string;
  claimed_at: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  status?: QuestionStatus;
  questionId?: string;
}

export interface XPResult {
  success: boolean;
  xp_earned: number;
  new_xp: number;
  level: string;
  message?: string;
}
