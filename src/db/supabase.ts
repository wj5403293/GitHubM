import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// 防御：URL 或 Key 缺失时抛出友好错误，而非让 createClient 内部崩溃
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[Supabase] 缺少环境变量 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY，" +
    "对话历史功能将不可用。请检查 .env 文件或 GitHub Repository Variables/Secrets。"
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder"
);
