// 粉丝 / 关注列表页

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, ExternalLink, ChevronLeft, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { getFollowers, getFollowing } from '@/services/github';
import type { GitHubUser } from '@/types/types';
import { toast } from 'sonner';

type ListType = 'followers' | 'following';

export default function FollowListPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const listType = (type === 'following' ? 'following' : 'followers') as ListType;
  const title = listType === 'followers' ? '我的粉丝' : '正在关注';
  const emptyText = listType === 'followers' ? '暂无粉丝' : '尚未关注任何人';

  const [list, setList] = useState<GitHubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const PER_PAGE = 30;

  const loadPage = useCallback(
    async (p: number) => {
      if (!user) return;
      const isFirst = p === 1;
      isFirst ? setLoading(true) : setLoadingMore(true);
      try {
        const data =
          listType === 'followers'
            ? await getFollowers(user.login, p, PER_PAGE)
            : await getFollowing(user.login, p, PER_PAGE);
        setList((prev) => (isFirst ? data : [...prev, ...data]));
        setHasMore(data.length === PER_PAGE);
      } catch {
        toast.error(`加载${title}失败`);
      } finally {
        isFirst ? setLoading(false) : setLoadingMore(false);
      }
    },
    [user, listType, title]
  );

  useEffect(() => {
    setList([]);
    setPage(1);
    setHasMore(true);
    loadPage(1);
  }, [loadPage]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadPage(next);
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      {/* 页头 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-foreground h-9 w-9"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-5 h-5 text-primary shrink-0" />
          <h1 className="text-lg font-bold text-foreground text-balance">{title}</h1>
          {!loading && (
            <span className="text-sm text-muted-foreground shrink-0">
              ({list.length}{hasMore ? '+' : ''})
            </span>
          )}
        </div>
      </div>

      {/* 列表 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="w-10 h-10 rounded-full bg-muted shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Skeleton className="h-3.5 w-28 bg-muted" />
                  <Skeleton className="h-3 w-20 bg-muted" />
                </div>
                <Skeleton className="h-7 w-16 bg-muted rounded-md shrink-0" />
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">{emptyText}</div>
        ) : (
          <div className="divide-y divide-border">
            {list.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors">
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarImage src={u.avatar_url} alt={u.login} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-semibold">
                    {u.login.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {u.name || u.login}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">@{u.login}</p>
                </div>
                <a
                  href={u.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    主页
                  </Button>
                </a>
              </div>
            ))}
          </div>
        )}

        {/* 加载更多 */}
        {!loading && hasMore && (
          <div className="px-4 py-3 border-t border-border">
            <Button
              variant="ghost"
              className="w-full text-sm text-muted-foreground hover:text-foreground hover:bg-secondary h-9"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />加载中...</>
              ) : (
                '加载更多'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
