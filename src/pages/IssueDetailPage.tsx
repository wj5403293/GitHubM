// Issue 详情页

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Send,
  ChevronRight,
  Edit2,
  X,
  Check,
  Tag,
  Sparkles,
  Loader2,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  getIssue,
  getIssueComments,
  createIssueComment,
  updateIssue,
  formatRelativeTime,
} from '@/services/github';
import type { GitHubIssue, GitHubComment } from '@/types/types';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useAiSummary, useAiSuggestions } from '@/hooks/useAiAssist';

export default function IssueDetailPage() {
  const { owner, repo, number } = useParams<{ owner: string; repo: string; number: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [comments, setComments] = useState<GitHubComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState(false);

  // AI 功能
  const aiSummary = useAiSummary();
  const aiSuggestions = useAiSuggestions();
  const [showAiPanel, setShowAiPanel] = useState(false);

  useEffect(() => {
    if (!owner || !repo || !number) return;
    const load = async () => {
      setLoading(true);
      try {
        const [issueData, commentsData] = await Promise.all([
          getIssue(owner, repo, Number(number)),
          getIssueComments(owner, repo, Number(number)),
        ]);
        setIssue(issueData);
        setComments(commentsData);
      } catch (err) {
        toast.error('加载 Issue 详情失败');
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
      const comment = await createIssueComment(owner, repo, Number(number), newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment('');
      toast.success('评论已发布');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '发布失败');
    } finally {
      setSubmitting(false);
    }
  };

  // Ctrl/Cmd+Enter 快捷提交评论
  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!submitting && newComment.trim()) handleComment();
    }
  };

  const handleToggleState = async () => {
    if (!owner || !repo || !number || !issue) return;
    setToggling(true);
    try {
      const newState = issue.state === 'open' ? 'closed' : 'open';
      const updated = await updateIssue(owner, repo, Number(number), { state: newState });
      setIssue(updated);
      toast.success(newState === 'closed' ? 'Issue 已关闭' : 'Issue 已重新打开');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-full bg-muted" />
        <Skeleton className="h-32 w-full bg-muted" />
        <Skeleton className="h-24 w-full bg-muted" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <p className="text-foreground">Issue 不存在</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <button type="button" className="hover:text-accent transition-colors" onClick={() => navigate('/repos')}>仓库</button>
        <ChevronRight className="w-3 h-3" />
        <button type="button" className="hover:text-accent transition-colors" onClick={() => navigate(`/repos/${owner}/${repo}`)}>{owner}/{repo}</button>
        <ChevronRight className="w-3 h-3" />
        <button type="button" className="hover:text-accent transition-colors" onClick={() => navigate(`/repos/${owner}/${repo}/issues`)}>Issues</button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">#{issue.number}</span>
      </div>

      {/* Issue 标题 */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <div className={`mt-1 shrink-0 ${issue.state === 'open' ? 'text-primary' : 'text-muted-foreground'}`}>
            {issue.state === 'open' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground text-balance">
              {issue.title}
              <span className="text-muted-foreground font-normal ml-2">#{issue.number}</span>
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge
                variant="outline"
                className={`text-xs ${issue.state === 'open' ? 'border-primary text-primary' : 'border-muted-foreground text-muted-foreground'}`}
              >
                {issue.state === 'open' ? '开放' : '已关闭'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {issue.user.login} 于 {formatRelativeTime(issue.created_at)} 创建 · {comments.length} 条评论
              </span>
            </div>
          </div>
          {/* AI + 状态切换 */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 text-xs gap-1 border transition-colors ${showAiPanel ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:bg-secondary'}`}
              onClick={() => {
                setShowAiPanel(!showAiPanel);
                if (!showAiPanel && issue && !aiSummary.summary && !aiSummary.loading) {
                  const ctx = `Issue 标题：${issue.title}\n内容：${issue.body || '（无描述）'}`;
                  aiSummary.generate(ctx).catch(() => toast.error('AI 摘要生成失败'));
                }
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`border-border h-8 ${issue.state === 'open' ? 'text-foreground hover:bg-secondary' : 'text-primary hover:bg-secondary'}`}
              onClick={handleToggleState}
              disabled={toggling}
            >
              {issue.state === 'open' ? (
                <><X className="w-3.5 h-3.5 mr-1" />关闭</>
              ) : (
                <><Check className="w-3.5 h-3.5 mr-1" />重新打开</>
              )}
            </Button>
          </div>
        </div>

        {/* 标签 */}
        {issue.labels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap ml-8">
            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            {issue.labels.map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                className="text-xs h-5 px-2"
                style={{
                  borderColor: `#${label.color}50`,
                  backgroundColor: `#${label.color}15`,
                  color: `#${label.color}`,
                }}
              >
                {label.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* AI 辅助面板 */}
      {showAiPanel && (
        <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            AI 辅助
          </div>
          {/* AI 摘要 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">内容摘要</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary hover:bg-primary/10 gap-1"
                onClick={() => {
                  const ctx = `Issue 标题：${issue.title}\n内容：${issue.body || '（无描述）'}`;
                  aiSummary.generate(ctx).catch(() => toast.error('AI 摘要生成失败'));
                }}
                disabled={aiSummary.loading}
              >
                {aiSummary.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {aiSummary.loading ? '生成中...' : '重新生成'}
              </Button>
            </div>
            <div className="bg-secondary/60 rounded-lg px-3 py-2 min-h-10 text-sm text-foreground">
              {aiSummary.loading && !aiSummary.summary
                ? <span className="text-muted-foreground italic flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />正在生成摘要...</span>
                : aiSummary.summary
                  ? aiSummary.summary
                  : <span className="text-muted-foreground italic">点击"重新生成"生成 AI 摘要</span>
              }
            </div>
          </div>
          {/* AI 回复建议 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">回复建议</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary hover:bg-primary/10 gap-1"
                onClick={() => {
                  const ctx = `Issue 标题：${issue.title}\n内容：${issue.body || '（无描述）'}`;
                  aiSuggestions.generate(ctx).catch(() => toast.error('AI 建议生成失败'));
                }}
                disabled={aiSuggestions.loading}
              >
                {aiSuggestions.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
                {aiSuggestions.loading ? '生成中...' : '生成建议'}
              </Button>
            </div>
            {aiSuggestions.suggestions.length > 0 ? (
              <div className="space-y-1.5">
                {aiSuggestions.suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left bg-secondary/60 hover:bg-secondary rounded-lg px-3 py-2 text-sm text-foreground transition-colors border border-transparent hover:border-border"
                    onClick={() => setNewComment(s)}
                    title="点击填入评论框"
                  >
                    <span className="text-primary font-medium mr-1.5">{i + 1}.</span>
                    {s}
                  </button>
                ))}
                <p className="text-[10px] text-muted-foreground pl-1">点击建议可自动填入评论框</p>
              </div>
            ) : aiSuggestions.loading ? (
              <div className="bg-secondary/60 rounded-lg px-3 py-2 text-sm text-muted-foreground italic flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />正在生成回复建议...
              </div>
            ) : (
              <div className="bg-secondary/60 rounded-lg px-3 py-2 text-sm text-muted-foreground italic">
                点击"生成建议"获取 AI 回复候选
              </div>
            )}
          </div>
        </div>
      )}

      {/* Issue 正文 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
          <Avatar className="w-6 h-6">
            <AvatarImage src={issue.user.avatar_url} />
            <AvatarFallback className="bg-secondary text-xs">{issue.user.login[0]}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground">{issue.user.login}</span>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(issue.created_at)}</span>
          <Badge variant="outline" className="ml-auto text-xs border-border text-muted-foreground">作者</Badge>
        </div>
        <div className="p-4">
          {issue.body ? (
            <MarkdownRenderer content={issue.body} />
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
            {user?.login === comment.user.login && (
              <Badge variant="outline" className="ml-auto text-xs border-border text-muted-foreground">你</Badge>
            )}
          </div>
          <div className="p-4">
            <MarkdownRenderer content={comment.body} />
          </div>
        </div>
      ))}

      {/* 添加评论 */}
      {user && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Avatar className="w-6 h-6">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="bg-secondary text-xs">{user.login[0]}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">添加评论</span>
          </div>
          <div className="p-4 space-y-3">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleCommentKeyDown}
              placeholder="撰写评论（支持 Markdown）..."
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground resize-none font-mono text-sm min-h-24"
              rows={4}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Edit2 className="w-3 h-3" />
                支持 Markdown · Ctrl+Enter 快速提交
              </span>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleComment}
                disabled={submitting || !newComment.trim()}
                size="sm"
              >
                {submitting ? (
                  '发布中...'
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    发布评论
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
