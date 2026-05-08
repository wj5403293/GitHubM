// GitHub Discussions 讨论区（REST API 有限支持）

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  MessageCircle,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getDiscussions, formatRelativeTime } from '@/services/github';
import type { GitHubDiscussion } from '@/types/types';
import { toast } from 'sonner';

export default function DiscussionsPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  const [discussions, setDiscussions] = useState<GitHubDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiUnavailable, setApiUnavailable] = useState(false);

  useEffect(() => {
    if (!owner || !repo) return;
    getDiscussions(owner, repo)
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) {
          setApiUnavailable(true);
        } else {
          setDiscussions(data);
        }
      })
      .catch(() => {
        setApiUnavailable(true);
        toast.error('Discussions API 暂不支持，请在 GitHub 网页中查看');
      })
      .finally(() => setLoading(false));
  }, [owner, repo]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <button type="button" className="hover:text-accent" onClick={() => navigate('/repos')}>仓库</button>
        <ChevronRight className="w-3 h-3" />
        <button type="button" className="hover:text-accent" onClick={() => navigate(`/repos/${owner}/${repo}`)}>{owner}/{repo}</button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Discussions</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          讨论区
        </h1>
        <a
          href={`https://github.com/${owner}/${repo}/discussions`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="ghost" size="sm" className="border border-border text-muted-foreground hover:bg-secondary h-9">
            <ExternalLink className="w-4 h-4 mr-2" />
            在 GitHub 中查看
          </Button>
        </a>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {[1,2,3,4].map(i => (
            <div key={i} className="p-4">
              <Skeleton className="h-5 w-2/3 bg-muted mb-2" />
              <Skeleton className="h-4 w-1/4 bg-muted" />
            </div>
          ))}
        </div>
      ) : apiUnavailable ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center px-6">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-semibold text-lg mb-2">GitHub Discussions API 限制</p>
          <p className="text-sm text-muted-foreground text-pretty max-w-md mx-auto mb-6">
            GitHub 的 Discussions 功能主要通过 GraphQL API 提供，REST API 支持有限。
            请前往 GitHub 网页端查看和管理讨论。
          </p>
          <a
            href={`https://github.com/${owner}/${repo}/discussions`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <ExternalLink className="w-4 h-4 mr-2" />
              前往 GitHub 讨论区
            </Button>
          </a>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
          {discussions.map((d) => (
            <div key={d.id} className="p-4 hover:bg-secondary/30 transition-colors group">
              <div className="flex items-start gap-3">
                <MessageCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={d.html_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:text-primary truncate text-balance">
                      {d.title}
                    </a>
                    {d.answer_html_url && (
                      <Badge className="bg-success/10 text-success border-success/30 text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />已解答
                      </Badge>
                    )}
                    {d.locked && <Badge variant="outline" className="text-xs border-border text-muted-foreground">已锁定</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <span>{d.category?.emoji}</span>
                      {d.category?.name}
                    </span>
                    <span>·</span>
                    <span>{d.author?.login}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatRelativeTime(d.created_at)}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{d.comments}</span>
                  </div>
                </div>
                <a href={d.html_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
