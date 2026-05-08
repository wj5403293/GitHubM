// PR 详情页

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  GitPullRequest,
  GitMerge,
  XCircle,
  MessageSquare,
  Send,
  ChevronRight,
  FileDiff,
  GitBranch,
  Plus,
  Minus,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getPullRequest,
  getPullRequestFiles,
  getPullRequestComments,
  createPullRequestComment,
  mergePullRequest,
  updatePullRequest,
  formatRelativeTime,
} from '@/services/github';
import type { GitHubPullRequest, GitHubComment, GitHubFile } from '@/types/types';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function PullDetailPage() {
  const { owner, repo, number } = useParams<{ owner: string; repo: string; number: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pr, setPr] = useState<GitHubPullRequest | null>(null);
  const [comments, setComments] = useState<GitHubComment[]>([]);
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [merging, setMerging] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!owner || !repo || !number) return;
    const load = async () => {
      setLoading(true);
      try {
        const [prData, commentsData, filesData] = await Promise.all([
          getPullRequest(owner, repo, Number(number)),
          getPullRequestComments(owner, repo, Number(number)),
          getPullRequestFiles(owner, repo, Number(number)),
        ]);
        setPr(prData);
        setComments(commentsData);
        setFiles(filesData);
      } catch (err) {
        toast.error('加载 PR 详情失败');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [owner, repo, number]);

  const handleComment = async () => {
    if (!owner || !repo || !number || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const comment = await createPullRequestComment(owner, repo, Number(number), newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment('');
      toast.success('评论已发布');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '发布失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMerge = async () => {
    if (!owner || !repo || !number) return;
    setMerging(true);
    try {
      await mergePullRequest(owner, repo, Number(number), { merge_method: 'merge' });
      toast.success('Pull Request 已合并！');
      const updated = await getPullRequest(owner, repo, Number(number));
      setPr(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '合并失败');
    } finally {
      setMerging(false);
    }
  };

  const handleClose = async () => {
    if (!owner || !repo || !number || !pr) return;
    setClosing(true);
    try {
      const newState = pr.state === 'open' ? 'closed' : 'open';
      const updated = await updatePullRequest(owner, repo, Number(number), { state: newState });
      setPr(updated);
      toast.success(newState === 'closed' ? 'PR 已关闭' : 'PR 已重新打开');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setClosing(false);
    }
  };

  const getPrIcon = () => {
    if (!pr) return null;
    if (pr.merged) return <GitMerge className="w-5 h-5 text-chart-4" />;
    if (pr.state === 'closed') return <XCircle className="w-5 h-5 text-destructive" />;
    return <GitPullRequest className="w-5 h-5 text-primary" />;
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-full bg-muted" />
        <Skeleton className="h-32 w-full bg-muted" />
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <p className="text-foreground">PR 不存在</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <button type="button" className="hover:text-accent" onClick={() => navigate('/repos')}>仓库</button>
        <ChevronRight className="w-3 h-3" />
        <button type="button" className="hover:text-accent" onClick={() => navigate(`/repos/${owner}/${repo}`)}>{owner}/{repo}</button>
        <ChevronRight className="w-3 h-3" />
        <button type="button" className="hover:text-accent" onClick={() => navigate(`/repos/${owner}/${repo}/pulls`)}>Pull Requests</button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">#{pr.number}</span>
      </div>

      {/* PR 标题 */}
      <div className="flex items-start gap-3">
        <div className="mt-1 shrink-0">{getPrIcon()}</div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground text-balance">
            {pr.title}
            <span className="text-muted-foreground font-normal ml-2">#{pr.number}</span>
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-sm text-muted-foreground">
            <span>{pr.user.login}</span>
            <span>·</span>
            <span>{formatRelativeTime(pr.created_at)} 创建</span>
            <div className="flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5" />
              <code className="font-mono text-xs">{pr.head.ref}</code>
              <span>→</span>
              <code className="font-mono text-xs">{pr.base.ref}</code>
            </div>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
          <FileDiff className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">{pr.changed_files} 个文件</span>
          <span className="text-primary">+{pr.additions}</span>
          <span className="text-destructive">-{pr.deletions}</span>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">{pr.comments + pr.review_comments} 条评论</span>
        </div>
      </div>

      {/* 操作按钮 */}
      {pr.state === 'open' && (
        <div className="flex flex-wrap gap-3 bg-card border border-border rounded-lg p-4">
          {!pr.merged && pr.state === 'open' && (
            <>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleMerge}
                disabled={merging}
              >
                <GitMerge className="w-4 h-4 mr-2" />
                {merging ? '合并中...' : '合并 Pull Request'}
              </Button>
              <Button
                variant="outline"
                className="border-border hover:bg-secondary"
                onClick={handleClose}
                disabled={closing}
              >
                <X className="w-4 h-4 mr-2" />
                关闭 PR
              </Button>
            </>
          )}
        </div>
      )}

      {pr.state === 'closed' && !pr.merged && (
        <div className="flex gap-3 bg-card border border-border rounded-lg p-4">
          <Button
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10"
            onClick={handleClose}
            disabled={closing}
          >
            <Check className="w-4 h-4 mr-2" />
            重新打开 PR
          </Button>
        </div>
      )}

      {/* 主内容标签 */}
      <Tabs defaultValue="description">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="description" className="data-[state=active]:bg-card data-[state=active]:text-foreground text-muted-foreground">
            描述与评论
          </TabsTrigger>
          <TabsTrigger value="files" className="data-[state=active]:bg-card data-[state=active]:text-foreground text-muted-foreground">
            文件变更 ({files.length})
          </TabsTrigger>
        </TabsList>

        {/* 描述与评论 */}
        <TabsContent value="description" className="space-y-4">
          {/* PR 正文 */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
              <Avatar className="w-6 h-6">
                <AvatarImage src={pr.user.avatar_url} />
                <AvatarFallback className="bg-secondary text-xs">{pr.user.login[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground">{pr.user.login}</span>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(pr.created_at)}</span>
              <Badge variant="outline" className="ml-auto text-xs border-border text-muted-foreground">作者</Badge>
            </div>
            <div className="p-4">
              {pr.body ? (
                <MarkdownRenderer content={pr.body} />
              ) : (
                <p className="text-muted-foreground text-sm italic">无描述</p>
              )}
            </div>
          </div>

          {/* 评论列表 */}
          {comments.map((comment) => (
            <div key={comment.id} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={comment.user.avatar_url} />
                  <AvatarFallback className="bg-secondary text-xs">{comment.user.login[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground">{comment.user.login}</span>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(comment.created_at)}</span>
              </div>
              <div className="p-4">
                <MarkdownRenderer content={comment.body} />
              </div>
            </div>
          ))}

          {/* 添加评论 */}
          {user && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-4 space-y-3">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="撰写评论（支持 Markdown）..."
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground resize-none font-mono text-sm min-h-24"
                  rows={4}
                />
                <div className="flex justify-end">
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleComment}
                    disabled={submitting || !newComment.trim()}
                    size="sm"
                  >
                    {submitting ? '发布中...' : <><Send className="w-3.5 h-3.5 mr-1.5" />发布评论</>}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* 文件变更 */}
        <TabsContent value="files" className="space-y-3">
          {files.map((file) => (
            <div key={file.filename} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
                <code className="text-xs text-foreground font-mono flex-1 min-w-0 truncate">{file.filename}</code>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-1 text-xs text-primary">
                    <Plus className="w-3 h-3" />{file.additions}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <Minus className="w-3 h-3" />{file.deletions}
                  </span>
                  <Badge variant="outline" className="text-xs border-border text-muted-foreground">{file.status}</Badge>
                </div>
              </div>
              {file.patch && (
                <div className="overflow-x-auto">
                  <pre className="text-xs p-4 font-mono leading-relaxed whitespace-pre-wrap text-foreground">
                    {file.patch.split('\n').map((line, i) => (
                      <span
                        key={i}
                        className={`block ${
                          line.startsWith('+') ? 'bg-primary/10 text-primary' :
                          line.startsWith('-') ? 'bg-destructive/10 text-destructive' :
                          line.startsWith('@@') ? 'text-accent' :
                          'text-muted-foreground'
                        }`}
                      >
                        {line}
                      </span>
                    ))}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
