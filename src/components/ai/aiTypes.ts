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
  // ── 新增字段 ────────────────────────────────────────────────────────────────
  /** 思考过程内容 */
  thinkingContent?: string;
  /** 思考是否完成 */
  thinkingDone?: boolean;
}// ── 工具调用记录类型 ────────────────────────────────────────────────────────────

export interface ToolHistoryItem {
  id: string;
  tool: string;
  label: string;
  hint: string;
  status: 'running' | 'success' | 'fail';
  startedAt: number;
  elapsedMs?: number;
  result?: string;
}

// ── SSE Typed Chunk 类型 ───────────────────────────────────────────────────────

export interface TaskPlanStep {
  id: string;
  title: string;
  desc: string;
}

export type SSEChunk =
  | { type: 'content'; content: string }
  | { type: 'think_start' }
  | { type: 'think_chunk'; content: string }
  | { type: 'think_end' }
  | { type: 'tool_start'; id: string; tool: string; label: string; hint: string }
  | { type: 'tool_end'; id: string; status: 'success' | 'fail'; result?: string; elapsedMs: number }
  | { type: 'plan'; steps: TaskPlanStep[] }
  | { type: 'step_start'; stepId: string }
  | { type: 'step_end'; stepId: string; status: 'done' | 'error' }
  | { type: 'step_retry'; stepId: string; retryCount: number }
  | { type: 'heartbeat' };

// ── 模型配置 ────────────────────────────────────────────────────────────────────

export interface ModelConfig {
  type: ModelType;
  api_key?: string;
  endpoint?: string;
  model?: string;
}