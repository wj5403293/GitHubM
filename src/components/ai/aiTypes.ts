// AI 助手共享类型定义

// ── 模型类型（在此定义，供 aiUtils.tsx 和其他文件导入，避免循环依赖）──────────────
export type ModelType = 'wenxin' | 'deepseek' | 'openai' | 'custom';

// ── 对话历史类型 ────────────────────────────────────────────────────────────────

export interface ChatSession {
  id: string;
  github_login: string;
  repo_full_name: string;
  branch: string;
  title: string;
  model_type: string;
  model_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// ── 消息类型 ────────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

// ── 模型配置 ────────────────────────────────────────────────────────────────────

export interface ModelConfig {
  type: ModelType;
  api_key?: string;
  endpoint?: string;
  model?: string;
}