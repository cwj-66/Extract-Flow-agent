import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { downloadTaskFile, getTask, getTaskContent, getTaskResult } from '../api/tasks';
import { ApiError } from '../api/client';
import { useMockStore } from '../store/mockStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import { FieldEditor } from '../components/detail/FieldEditor';
import { FeishuCardPreview } from '../components/detail/FeishuCardPreview';
import { MarkdownViewer } from '../components/detail/MarkdownViewer';
import { ConfirmSendModal } from '../components/detail/ConfirmSendModal';
import { FieldSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { formatRelativeTime } from '../lib/status';
import type { ExtractionFields, TaskStatus, TaskSummary } from '../types';

type TabKey = 'edit' | 'preview' | 'markdown';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'edit', label: '编辑字段' },
  { key: 'preview', label: '卡片预览' },
  { key: 'markdown', label: '原文 Markdown' },
];

const POLLING_STATUSES = new Set<TaskStatus>(['queued', 'parsing', 'extracting', 'sending']);
const RESULT_READY_STATUSES = new Set<TaskStatus>([
  'pending_confirm',
  'sending',
  'sent',
  'failed',
]);
const CONTENT_READY_STATUSES = new Set<TaskStatus>([
  'extracting',
  'pending_confirm',
  'sending',
  'sent',
  'failed',
]);
const CONFIRMABLE_STATUSES = new Set<TaskStatus>(['pending_confirm', 'failed']);

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pollIntervalSec = useMockStore((s) => s.generalSettings.pollIntervalSec);

  const [task, setTask] = useState<TaskSummary | null>(null);
  const [originalFields, setOriginalFields] = useState<ExtractionFields | undefined>();
  const [localFields, setLocalFields] = useState<ExtractionFields | undefined>();
  const [markdown, setMarkdown] = useState('');
  const [markdownCharCount, setMarkdownCharCount] = useState(0);
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [markdownError, setMarkdownError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('edit');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const contentLoadedRef = useRef(false);

  useEffect(() => {
    contentLoadedRef.current = false;
    setMarkdown('');
    setMarkdownCharCount(0);
    setMarkdownError(null);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    let timer: number | undefined;

    const loadContent = async () => {
      if (contentLoadedRef.current) return;
      setMarkdownLoading(true);
      try {
        const content = await getTaskContent(id);
        if (cancelled) return;
        setMarkdown(content.content);
        setMarkdownCharCount(content.char_count);
        setMarkdownError(null);
        contentLoadedRef.current = true;
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 409) {
          setMarkdownError(null);
        } else {
          setMarkdownError(err instanceof ApiError ? err.message : '加载原文失败');
        }
      } finally {
        if (!cancelled) setMarkdownLoading(false);
      }
    };

    const tick = async () => {
      try {
        const summary = await getTask(id);
        if (cancelled) return;
        setTask(summary);
        setError(null);
        setLoading(false);

        if (RESULT_READY_STATUSES.has(summary.status)) {
          try {
            const result = await getTaskResult(id);
            if (cancelled) return;
            setOriginalFields(result.fields);
            if (!dirtyRef.current) {
              setLocalFields(result.fields);
            }
          } catch (err) {
            if (!(err instanceof ApiError && err.status === 409)) {
              console.warn('getTaskResult failed', err);
            }
          }
        }

        if (CONTENT_READY_STATUSES.has(summary.status)) {
          await loadContent();
        }

        if (POLLING_STATUSES.has(summary.status)) {
          timer = window.setTimeout(tick, pollIntervalSec * 1000);
        }
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        setError(err instanceof ApiError ? err.message : '加载任务失败');
      }
    };

    setLoading(true);
    void tick();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [id, pollIntervalSec, reloadKey]);

  useEffect(() => {
    if (!id || activeTab !== 'markdown' || contentLoadedRef.current) return;
    if (task && (task.status === 'queued' || task.status === 'parsing')) return;

    let cancelled = false;
    setMarkdownLoading(true);
    getTaskContent(id)
      .then((content) => {
        if (cancelled) return;
        setMarkdown(content.content);
        setMarkdownCharCount(content.char_count);
        setMarkdownError(null);
        contentLoadedRef.current = true;
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 409) {
          setMarkdownError(null);
        } else {
          setMarkdownError(err instanceof ApiError ? err.message : '加载原文失败');
        }
      })
      .finally(() => {
        if (!cancelled) setMarkdownLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, activeTab, task?.status]);

  const fields = localFields ?? originalFields;
  const isProcessing = task ? POLLING_STATUSES.has(task.status) && task.status !== 'sending' : false;
  const canConfirm = Boolean(task && CONFIRMABLE_STATUSES.has(task.status));
  const isReadOnly = !canConfirm;

  const handleFieldChange = (updated: ExtractionFields) => {
    setLocalFields(updated);
    setDirty(true);
  };

  const handleSave = (updated: ExtractionFields) => {
    setLocalFields(updated);
    setOriginalFields(updated);
    setDirty(false);
    toast.success('已保存本地修改', {
      description: '确认发送时会一并提交到后端',
    });
  };

  const handleDiscard = () => {
    setLocalFields(originalFields);
    setDirty(false);
    toast.info('已放弃修改');
  };

  const handleSent = (status: TaskStatus) => {
    if (!task) return;
    setTask({ ...task, status, updated_at: new Date().toISOString() });
    setDirty(false);
  };

  const handleDownload = async () => {
    if (!task) return;
    setDownloading(true);
    try {
      await downloadTaskFile(task.id, task.source_file);
      toast.success('开始下载原文件');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '下载失败';
      toast.error('下载失败', { description: message });
    } finally {
      setDownloading(false);
    }
  };

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-slate-600">缺少任务 ID</p>
        <Link to="/tasks" className="mt-4 text-sm text-teal-600 hover:underline">
          返回列表
        </Link>
      </div>
    );
  }

  if (loading && !task) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-stone-200/70 bg-white/90 p-5 shadow-sm">
          <FieldSkeleton />
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="rounded-2xl border border-stone-200/70 bg-white/90 shadow-md">
        <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-slate-600">找不到任务 {id}</p>
        <Link to="/tasks" className="mt-4 text-sm text-teal-600 hover:underline">
          返回列表
        </Link>
      </div>
    );
  }

  const markdownEmptyHint =
    task.status === 'queued' || task.status === 'parsing'
      ? '文档解析完成后可查看清洗原文'
      : (markdownError ?? '暂无原文内容');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200/70 bg-white/90 p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
            aria-label="返回任务列表"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            返回列表
          </button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-slate-900">
                {task.company_name ?? '—'}
                {task.stock_code && (
                  <span className="ml-1.5 text-sm font-normal text-slate-500">
                    · {task.stock_code}
                  </span>
                )}
              </h2>
              <StatusBadge status={task.status} />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {task.source_file} · 更新于 {formatRelativeTime(task.updated_at)}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="下载原文"
              aria-busy={downloading}
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {downloading ? '下载中…' : '下载原文'}
            </button>

            <button
              disabled={!canConfirm}
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
              aria-label={
                task.status === 'sent'
                  ? '已发送'
                  : task.status === 'failed'
                    ? '重新发送到飞书'
                    : canConfirm
                      ? '确认发送到飞书'
                      : '字段未就绪'
              }
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              {task.status === 'sent'
                ? '已发送'
                : task.status === 'failed'
                  ? '重新发送到飞书'
                  : '确认发送到飞书'}
            </button>
          </div>
        </div>

        {task.error_message && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            错误：{task.error_message}
          </div>
        )}
      </div>

      <div>
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition ${
                activeTab === key
                  ? 'border-b-2 border-teal-600 text-teal-700'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
              {key === 'edit' && dirty && (
                <span
                  className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-500"
                  aria-label="有未保存修改"
                />
              )}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {activeTab === 'edit' && (
            <>
              {isProcessing ? (
                <div>
                  <div className="mb-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
                    字段提取中，请稍候…（约 {pollIntervalSec} 秒自动刷新）
                  </div>
                  <FieldSkeleton />
                </div>
              ) : fields ? (
                <FieldEditor
                  fields={fields}
                  originalFields={originalFields ?? fields}
                  readOnly={isReadOnly}
                  onChange={handleFieldChange}
                  onSave={handleSave}
                  onDiscard={handleDiscard}
                  dirty={dirty}
                />
              ) : (
                <div className="rounded-2xl border border-stone-200/70 bg-white/90 px-6 py-12 text-center text-sm text-slate-400">
                  {task.status === 'failed' ? '任务失败，暂无提取结果' : '暂无提取结果'}
                </div>
              )}
            </>
          )}

          {activeTab === 'preview' && (
            <>
              {fields ? (
                <FeishuCardPreview fields={fields} sourceFile={task.source_file} />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-sm text-slate-400">
                  字段提取完成后可预览卡片
                </div>
              )}
            </>
          )}

          {activeTab === 'markdown' && (
            <MarkdownViewer
              content={markdown}
              charCount={markdownCharCount}
              loading={markdownLoading && !markdown}
              emptyHint={markdownEmptyHint}
            />
          )}
        </div>
      </div>

      {showConfirmModal && (
        <ConfirmSendModal
          taskId={task.id}
          companyName={fields?.company_name ?? task.company_name}
          fields={fields}
          onClose={() => setShowConfirmModal(false)}
          onSent={handleSent}
        />
      )}
    </div>
  );
}
