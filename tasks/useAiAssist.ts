// AI 辅助功能 Hook（基于文心大模型）

import { useState, useRef, useCallback } from 'react';
import { sendStreamRequest, parseWenxinChunk } from '@/lib/sse';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/wenxin-text-generation`;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('AI Assist: Missing Supabase configuration (VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY)');
}

/** 流式生成文本，返回完整内容 */
async function generateText(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  onChunk: (chunk: string) => void,
  signal: AbortSignal
): Promise<string> {
  let full = '';
  await sendStreamRequest({
    functionUrl: FUNCTION_URL,
    requestBody: { messages },
    supabaseAnonKey: SUPABASE_ANON_KEY,
    onData: (data) => {
      const chunk = parseWenxinChunk(data);
      if (chunk) {
        full += chunk;
        onChunk(chunk);
      }
    },
    onComplete: () => {},
    onError: (err) => { throw err; },
    signal,
  });
  return full;
}

// ===== AI 摘要 Hook =====
export interface UseAiSummaryResult {
  summary: string;
  loading: boolean;
  generate: (context: string) => Promise<void>;
  clear: () => void;
}

export function useAiSummary(): UseAiSummaryResult {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (context: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setSummary('');
    setLoading(true);
    try {
      await generateText(
        [
          {
            role: 'system',
            content: '你是一个 GitHub 项目助手，擅长简洁总结 Issue 和 PR 内容。',
          },
          {
            role: 'user',
            content: `请用不超过100字，简洁总结以下内容的核心要点（直接输出摘要，不要引言）：\n\n${context}`,
          },
        ],
        (chunk) => setSummary((prev) => prev + chunk),
        abortRef.current.signal
      );
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setSummary('');
    setLoading(false);
  }, []);

  return { summary, loading, generate, clear };
}

// ===== AI 回复建议 Hook =====
export interface UseAiSuggestionsResult {
  suggestions: string[];
  loading: boolean;
  generate: (context: string) => Promise<void>;
  clear: () => void;
}

export function useAiSuggestions(): UseAiSuggestionsResult {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [rawBuffer, setRawBuffer] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (context: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setSuggestions([]);
    setRawBuffer('');
    setLoading(true);
    try {
      const full = await generateText(
        [
          {
            role: 'system',
            content: '你是一个 GitHub 项目助手，帮助用户快速回复 Issue 或 PR。',
          },
          {
            role: 'user',
            content: `根据以下 GitHub Issue/PR 内容，生成 3 条简洁的回复候选（每条不超过50字）。\n格式要求：每条回复单独一行，以"1. ""2. ""3. "开头。\n\n内容：\n${context}`,
          },
        ],
        (chunk) => setRawBuffer((prev) => prev + chunk),
        abortRef.current.signal
      );
      // 解析编号列表
      const lines = full
        .split('\n')
        .map((l) => l.replace(/^[\d]+[.、。]\s*/, '').trim())
        .filter((l) => l.length > 0)
        .slice(0, 3);
      setSuggestions(lines);
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') throw err;
    } finally {
      setLoading(false);
      setRawBuffer('');
    }
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setSuggestions([]);
    setLoading(false);
    setRawBuffer('');
  }, []);

  // 流式生成时实时解析部分结果
  const liveSuggestions = suggestions.length > 0 ? suggestions : (
    rawBuffer
      ? rawBuffer.split('\n').map((l) => l.replace(/^[\d]+[.、。]\s*/, '').trim()).filter((l) => l.length > 0).slice(0, 3)
      : []
  );

  return { suggestions: liveSuggestions, loading, generate, clear };
}
