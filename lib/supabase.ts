import { createClient } from '@supabase/supabase-js';
import type { Question, Profile, XPResult } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Submit a new question
export async function submitQuestion(content: string, askerId?: string): Promise<Question | null> {
  const { data, error } = await supabase
    .from('questions')
    .insert({
      content,
      asker_id: askerId ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('submitQuestion error:', error);
    return null;
  }
  return data;
}

// Atomic claim — returns true if successful
export async function claimQuestion(questionId: string, responderId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_question', {
    question_id: questionId,
    responder: responderId,
  });

  if (error) {
    console.error('claimQuestion error:', error);
    return false;
  }
  return data as boolean;
}

// Submit answer and award XP
export async function submitAnswer(
  questionId: string,
  answer: string,
  responseTimeSeconds: number
): Promise<XPResult | null> {
  const { data, error } = await supabase.rpc('submit_answer', {
    question_id: questionId,
    answer,
    response_time_seconds: responseTimeSeconds,
  });

  if (error) {
    console.error('submitAnswer error:', error);
    return null;
  }
  return data as XPResult;
}

// Fetch pending questions for hub
export async function fetchPendingQuestions(): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchPendingQuestions error:', error);
    return [];
  }
  return data ?? [];
}

// Fetch profile
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data;
}

// Sign in with email/password
export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

// Sign up with username
export async function signUp(email: string, password: string, username: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
}

// Sign out
export async function signOut() {
  return supabase.auth.signOut();
}
