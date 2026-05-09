// 主题上下文 - 支持深色/浅色/跟随系统

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  resolvedTheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'github_manager_theme';
const DARK_COLOR  = '#1e1b4b';
const LIGHT_COLOR = '#f5f3ff';

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** 同步更新 <meta name="theme-color"> 让安卓 WebView 状态栏颜色与页面一致 */
function updateThemeColorMeta(isDark: boolean) {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute('content', isDark ? DARK_COLOR : LIGHT_COLOR);
}

function applyTheme(mode: ThemeMode) {
  const resolved = mode === 'system' ? getSystemTheme() : mode;
  const html = document.documentElement;
  if (resolved === 'dark') {
    html.classList.add('dark');
    html.classList.remove('light');
  } else {
    html.classList.add('light');
    html.classList.remove('dark');
  }
  updateThemeColorMeta(resolved === 'dark');
  // 通知 APK 壳同步更新状态栏与底部导航栏颜色
  notifyAndroidTheme(resolved === 'dark');
  return resolved;
}

/**
 * 向 Android 原生层推送主题变化。
 * AndroidBridge 由 MainActivity 的 addJavascriptInterface 注入，
 * 纯浏览器环境中不存在，通过可选链安全调用。
 */
function notifyAndroidTheme(isDark: boolean) {
  try {
    (window as unknown as { AndroidBridge?: { notifyTheme?: (d: boolean) => void } })
      .AndroidBridge?.notifyTheme?.(isDark);
  } catch {
    // 非 APK 环境或旧版本壳，静默忽略
  }
}

/**
 * 触发主题切换过渡动画：
 * 向 <html> 添加 theme-transitioning class，CSS 中借助它激活全局 transition，
 * 动画结束后移除，避免页面初始加载时也触发不必要的过渡。
 */
function triggerThemeTransition(callback: () => void) {
  const html = document.documentElement;
  html.classList.add('theme-transitioning');
  callback();
  // 等待最长过渡时长后移除（300ms 与 CSS 对齐）
  setTimeout(() => html.classList.remove('theme-transitioning'), 350);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return saved || 'dark';
  });
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(() =>
    applyTheme((localStorage.getItem(STORAGE_KEY) as ThemeMode | null) || 'dark')
  );

  const setTheme = useCallback((t: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
    triggerThemeTransition(() => {
      setResolvedTheme(applyTheme(t));
    });
  }, []);

  // 跟随系统变化
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      triggerThemeTransition(() => setResolvedTheme(applyTheme('system')));
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
