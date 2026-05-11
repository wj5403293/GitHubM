// 历史会话面板：memo 优化 + @tanstack/react-virtual 虚拟滚动
// 扁平化分组项（section 标题 + 会话行）统一放入 virtualizer，解决分组标题随数据增长仍重渲染问题
import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Trash2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { ChatSession, ChatSessionMessage } from './aiTypes';
import { fetchSessions, fetchSessionMessages, deleteSession } from './aiSupabase';

// 虚拟行类型：区分 section 标题行 和 会话数据行
type VirtualRow =
  | { kind: 'header'; repo: string }
  | { kind: 'session'; session: ChatSession };

const SESSION_HEIGHT = 60;  // px — 会话行估算高度
const HEADER_HEIGHT  = 32;  // px — 分组标题行估算高度
const OVERSCAN       = 5;

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  login: string;
  onLoad: (session: ChatSession, messages: ChatSessionMessage[]) => void;
}

const HistoryPanel = memo(function HistoryPanel({
  open,
  onClose,
  login,
  onLoad,
}: HistoryPanelProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // 虚拟滚动容器 ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!login) return;
    setLoading(true);
    const data = await fetchSessions(login);
    setSessions(data);
    setLoading(false);
  }, [login]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleLoad = async (session: ChatSession) => {
    const msgs = await fetchSessionMessages(session.id);
    onLoad(session, msgs);
    onClose();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(id);
    await deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    setDeleting(null);
    toast.success('对话已删除');
  };

  // ── 构建扁平化虚拟行列表（分组标题 + 会话行交叉排列）──────────────
  const rows = (() => {
    const grouped: Record<string, ChatSession[]> = {};
    for (const s of sessions) {
      if (!grouped[s.repo_full_name]) grouped[s.repo_full_name] = [];
      grouped[s.repo_full_name].push(s);
    }
    const result: VirtualRow[] = [];
    for (const [repo, items] of Object.entries(grouped)) {
      result.push({ kind: 'header', repo });
      for (const s of items) result.push({ kind: 'session', session: s });
    }
    return result;
  })();

  // ── 虚拟滚动 ────────────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (i) => rows[i].kind === 'header' ? HEADER_HEIGHT : SESSION_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalHeight  = virtualizer.getTotalSize();

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-80 p-0 flex flex-col bg-sidebar">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-sidebar-foreground">历史对话</span>
          </div>
          <span className="text-xs text-muted-foreground">{sessions.length} 条</span>
        </div>

        {/* 虚拟滚动容器 */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            /* 骨架屏 */
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5 p-2">
                  <Skeleton className="h-3.5 w-3/4 bg-muted" />
                  <Skeleton className="h-3 w-1/2 bg-muted" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            /* 空状态 */
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">暂无历史对话</p>
            </div>
          ) : (
            /* 虚拟滚动内容区 */
            <div style={{ height: totalHeight, position: 'relative' }}>
              {virtualItems.map(vItem => {
                const row = rows[vItem.index];
                return (
                  <div
                    key={vItem.key}
                    data-index={vItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vItem.start}px)`,
                    }}
                  >
                    {row.kind === 'header' ? (
                      /* 分组标题行 */
                      <div className="px-4 py-2 bg-muted/30 border-b border-border/50">
                        <span className="text-[10px] font-mono text-muted-foreground font-medium truncate block">
                          {row.repo}
                        </span>
                      </div>
                    ) : (
                      /* 会话行 */
                      <button
                        onClick={() => handleLoad(row.session)}
                        className="w-full flex items-start gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left group border-b border-border/30 last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-sidebar-foreground truncate">{row.session.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[90px]">
                              {row.session.branch}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(row.session.updated_at).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={e => handleDelete(row.session.id, e)}
                          disabled={deleting === row.session.id}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
});

export default HistoryPanel;
