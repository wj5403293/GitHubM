// 首页仪表盘

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Star,
  GitFork,
  Users,
  Eye,
  Clock,
  TrendingUp,
  Activity,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { getUserRepos, getUserEvents, formatRelativeTime, formatNumber, getLanguageColor } from '@/services/github';
import type { GitHubRepo, GitHubEvent } from '@/types/types';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [reposResult, eventsResult] = await Promise.all([
          getUserRepos({ sort: 'pushed', per_page: 6, type: 'owner' }),
          getUserEvents(user.login, 1),
        ]);
        setRepos(reposResult.data);
        setEvents(eventsResult.slice(0, 15));
      } catch (err) {
        toast.error('加载仪表盘数据失败');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const getEventDescription = (event: GitHubEvent): string => {
    const repoName = event.repo.name;
    switch (event.type) {
      case 'PushEvent': {
        const payload = event.payload as { commits?: unknown[] };
        const count = payload.commits?.length || 0;
        return `推送了 ${count} 个提交到 ${repoName}`;
      }
      case 'CreateEvent': {
        const payload = event.payload as { ref_type?: string; ref?: string };
        return `在 ${repoName} 创建了 ${payload.ref_type} ${payload.ref || ''}`;
      }
      case 'IssuesEvent': {
        const payload = event.payload as { action?: string; issue?: { title?: string } };
        return `${payload.action === 'opened' ? '创建了' : payload.action === 'closed' ? '关闭了' : '更新了'} Issue: ${payload.issue?.title || ''} (${repoName})`;
      }
      case 'PullRequestEvent': {
        const payload = event.payload as { action?: string; pull_request?: { title?: string } };
        return `${payload.action === 'opened' ? '创建了' : payload.action === 'closed' ? '关闭了' : '更新了'} PR: ${payload.pull_request?.title || ''} (${repoName})`;
      }
      case 'WatchEvent':
        return `标星了 ${repoName}`;
      case 'ForkEvent':
        return `Fork 了 ${repoName}`;
      case 'IssueCommentEvent':
        return `评论了 ${repoName} 的 Issue`;
      case 'PullRequestReviewEvent':
        return `审查了 ${repoName} 的 Pull Request`;
      default:
        return `在 ${repoName} 有新活动`;
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* 用户信息卡片 */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex flex-col md:flex-row gap-4 items-start">
          <Avatar className="w-16 h-16 shrink-0">
            <AvatarImage src={user.avatar_url} alt={user.login} />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xl font-bold">
              {user.login.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground text-balance">{user.name || user.login}</h1>
              <span className="text-muted-foreground text-sm">@{user.login}</span>
            </div>
            {user.bio && (
              <p className="text-sm text-muted-foreground mt-1 text-pretty">{user.bio}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-3">
              {user.company && (
                <span className="text-xs text-muted-foreground">{user.company}</span>
              )}
              {user.location && (
                <span className="text-xs text-muted-foreground">{user.location}</span>
              )}
              {user.blog && (
                <a
                  href={user.blog.startsWith('http') ? user.blog : `https://${user.blog}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline flex items-center gap-1"
                >
                  {user.blog}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          <a
            href={user.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 shrink-0 text-sm font-medium
                       border border-border rounded-md px-3 h-9
                       bg-background hover:bg-secondary transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            GitHub 主页
          </a>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '公开仓库', value: user.public_repos, icon: BookOpen, color: 'text-primary' },
          { label: '关注者', value: user.followers, icon: Users, color: 'text-accent' },
          { label: '正在关注', value: user.following, icon: Eye, color: 'text-chart-3' },
          { label: '公开 Gist', value: user.public_gists, icon: TrendingUp, color: 'text-chart-4' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="bg-card border-border h-full">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatNumber(stat.value)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 最近仓库 + 活动时间线 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近仓库 */}
        <Card className="bg-card border-border h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold text-foreground">最近仓库</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-accent hover:bg-secondary text-xs h-7"
              onClick={() => navigate('/repos')}
            >
              查看全部
            </Button>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {loading ? (
              <div className="px-4 pb-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 bg-muted rounded-md" />
                ))}
              </div>
            ) : repos.length === 0 ? (
              <div className="px-4 pb-4 text-center text-muted-foreground text-sm py-8">
                暂无仓库
              </div>
            ) : (
              <div className="divide-y divide-border">
                {repos.map((repo) => (
                  <button
                    key={repo.id}
                    type="button"
                    className="w-full px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                    onClick={() => navigate(`/repos/${repo.full_name}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-accent truncate">{repo.name}</span>
                          {repo.private && (
                            <Badge variant="outline" className="text-xs border-border text-muted-foreground h-4 px-1">私有</Badge>
                          )}
                          {repo.fork && (
                            <GitFork className="w-3 h-3 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate text-pretty">{repo.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {repo.language && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: getLanguageColor(repo.language) }}
                              />
                              {repo.language}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Star className="w-3 h-3" />
                            {formatNumber(repo.stargazers_count)}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(repo.pushed_at)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 活动时间线 */}
        <Card className="bg-card border-border h-full flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              最近活动
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-y-auto" style={{ maxHeight: '400px' }}>
            {loading ? (
              <div className="px-4 pb-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 bg-muted rounded-md" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="px-4 pb-4 text-center text-muted-foreground text-sm py-8">
                暂无活动记录
              </div>
            ) : (
              <div className="px-4 pb-4 space-y-0">
                {events.map((event, index) => (
                  <div key={event.id} className="flex gap-3 py-3 border-b border-border last:border-0">
                    <div className="w-1 shrink-0 relative">
                      <div className={`w-2 h-2 rounded-full bg-primary mt-1 -ml-0.5 ${index === 0 ? 'ring-2 ring-primary/20' : ''}`} />
                      {index < events.length - 1 && (
                        <div className="absolute top-3 left-0.5 w-px h-full bg-border" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground text-pretty">{getEventDescription(event)}</p>
                      <span className="text-xs text-muted-foreground mt-0.5 block">
                        {formatRelativeTime(event.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
