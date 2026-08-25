import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  downloadTaskFile,
  getTask,
  getTaskContent,
  getTaskResult,
  subscribeTaskEvents,
} from '../api/tasks';
import { ApiError } from '../api/client';
import { useMockStore } from '../store/mockStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import { FieldEditor } from '../components/detail/FieldEditor';
import { FeishuCardPreview } from '../components/detail/FeishuCardPreview';
import { SourcePane } from '../components/detail/SourcePane';
import { ConfirmSendModal } from '../components/detail/ConfirmSendModal';
import { PipelineStepper } from '../components/detail/PipelineStepper';
import { MetricsBar } from '../components/detail/MetricsBar';
import { FieldSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { formatRelativeTime } from '../lib/status';
import { mergeEvidence } from '../lib/fields';
import type {
  ExtractionFields,
  ExtractionMetrics,
  FieldEvidence,
  TaskStatus,
  TaskSummary,
} from '../types';

type RightTab = 'edit' | 'preview';

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
  const [evidence, setEvidence] = useState<FieldEvidence[]>([]);
  const [metrics, setMetrics] = useState<ExtractionMetrics | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [markdownCharCount, setMarkdownCharCount] = useState(0);
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [markdownError, setMarkdownError] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('edit');
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const contentLoadedRef = useRef(false);
  const resultLoadedRef = useRef(false);

  useEffect(() => {
    contentLoadedRef.current = false;
    resultLoadedRef.current = false;
    setMarkdown('');
    setMarkdownCharCount(0);
    setMarkdownError(null);
    setEvidence([]);
    setMetrics(null);
    setSelectedField(null);
    setDirty(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    let timer: number | undefined;
    let stopEvents: (() => void) | undefined;
    let fallbackPoll = false;

    const loadContent = async (status: TaskStatus) => {
      if (contentLoadedRef.current || !CONTENT_READY_STATUSES.has(status)) return;
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
        if (!(err instanceof ApiError && err.status === 409)) {
          setMarkdownError(err instanceof ApiError ? err.message : '加载原文失败');
        }
      } finally {
        if (!cancelled) setMarkdownLoading(false);
      }
    };

    const loadResult = async (status: TaskStatus) => {
      if (!RESULT_READY_STATUSES.has(status)) return;
      try {
        const result = await getTaskResult(id);
        if (cancelled) return;
        if (!resultLoadedRef.current) {
          setOriginalFields(result.fields);
          resultLoadedRef.current = true;
        }
        setEvidence(result.evidence ?? []);
        setMetrics(result.metrics);
        if (!dirtyRef.current) setLocalFields(result.fields);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 409)) {
          console.warn('getTaskResult failed', err);
        }
      }
    };

    const applySummary = async (summary: TaskSummary) => {
      if (cancelled) return;
      setTask(summary);
      setError(null);
      setLoading(false);
      await loadContent(summary.status);
      await loadResult(summary.status);
    };

    const poll = async () => {
      try {
        const summary = await getTask(id);
        await applySummary(summary);
        if (POLLING_STATUSES.has(summary.status)) {
          timer = window.setTimeout(poll, pollIntervalSec * 1000);
        }
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        setError(err instanceof ApiError ? err.message : '加载任务失败');
      }
    };

    stopEvents = subscribeTaskEvents(
      id,
      (summary) => {
        void applySummary(summary);
      },
      () => {
        if (cancelled || fallbackPoll) return;
        fallbackPoll = true;
        void poll();
      }
    );
    void getTask(id).then(applySummary).catch((err) => {
      if (cancelled) return;
      setLoading(false);
      setError(err instanceof ApiError ? err.message : '加载任务失败');
    });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      stopEvents?.();
    };
  }, [id, pollIntervalSec, reloadKey]);

  const fields = localFields ?? originalFields;
  const isProcessing = task ? POLLING_STATUSES.has(task.status) && task.status !== 'sending' : false;
  const canConfirm = Boolean(task && CONFIRMABLE_STATUSES.has(task.status));
  const isReadOnly = !canConfirm;
  const byField = mergeEvidence(evidence, markdown, fields);
  const highlight = selectedField ? byField[selectedField] ?? null : null;

  const handleFieldChange = (updated: ExtractionFields) => {
    setLocalFields(updated);
    setDirty(true);
  };

  const handleSave = (updated: ExtractionFields) => {
    setLocalFields(updated);
    setDirty(false);
    toast.success('已保存本地修改', {
      description: '确认发送时会一并提交到后端；与 AI 原文的差异仍会标出',
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
        <p className="text-sm text-muted">缺少任务 ID</p>
        <Link to="/tasks" className="mt-4 text-sm text-brand hover:underline">
          返回列表
        </Link>
      </div>
    );
  }

  if (loading && !task) {
    return (
      <div className="p-5">
        <FieldSkeleton />
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="m-4 rounded-xl border border-line bg-surface">
        <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted">找不到任务 {id}</p>
        <Link to="/tasks" className="mt-4 text-sm text-brand hover:underline">
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
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <header className="flex-shrink-0 border-b border-line bg-surface px-5 py-3.5">
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-1 text-xs text-muted hover:text-ink"
            aria-label="返回任务列表"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            返回列表
          </button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                {task.company_name ?? '—'}
                {task.stock_code && (
                  <span className="ml-1.5 text-sm font-normal text-muted">
                    · {task.stock_code}
                  </span>
                )}
              </h2>
              <StatusBadge status={task.status} />
            </div>
            <p className="mt-1 text-xs text-subtle">
              {task.source_file} · 更新于 {formatRelativeTime(task.updated_at)}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="ef-btn ef-btn-secondary"
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
              className="ef-btn ef-btn-primary"
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <PipelineStepper status={task.status} />
          <MetricsBar metrics={metrics} />
        </div>

        {task.error_message && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            错误：{task.error_message}
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-line bg-surface lg:border-b-0 lg:border-r">
          <SourcePane
            content={markdown}
            charCount={markdownCharCount}
            loading={markdownLoading && !markdown}
            emptyHint={markdownEmptyHint}
            highlight={highlight}
          />
        </section>

        <aside className="flex min-h-0 w-full flex-col bg-canvas lg:w-[420px] lg:flex-shrink-0">
          <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b border-line bg-surface px-2">
            {(
              [
                ['edit', '字段审阅'],
                ['preview', '卡片预览'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={rightTab === key}
                onClick={() => setRightTab(key)}
                className={`relative rounded-md px-3 py-1.5 text-sm font-medium ${
                  rightTab === key
                    ? 'bg-brand-soft text-brand'
                    : 'text-muted hover:bg-canvas hover:text-ink'
                }`}
              >
                {label}
                {key === 'edit' && dirty && (
                  <span
                    className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500"
                    aria-label="有未保存修改"
                  />
                )}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {rightTab === 'edit' && (
              <>
                {isProcessing ? (
                  <div>
                    <div className="mb-3 rounded-lg border border-teal-100 bg-brand-soft px-3 py-2 text-sm text-brand">
                      {task.status === 'parsing' ? '版面解析中…' : '字段提取中…'}
                      状态会自动刷新
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
                    selectedField={selectedField}
                    onSelectField={setSelectedField}
                    evidenceByField={byField}
                  />
                ) : (
                  <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center text-sm text-subtle">
                    {task.status === 'failed' ? '任务失败，暂无提取结果' : '暂无提取结果'}
                  </div>
                )}
              </>
            )}

            {rightTab === 'preview' && (
              <>
                {fields ? (
                  <FeishuCardPreview fields={fields} sourceFile={task.source_file} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-sm text-subtle">
                    字段提取完成后可预览卡片
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
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
