import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  File,
  FolderOpen,
  X,
  Loader2,
  AlertCircle,
  Files,
} from 'lucide-react';
import { toast } from 'sonner';
import { uploadBatch, uploadDocument, listTasks } from '../api/tasks';
import { ApiError } from '../api/client';
import { formatRelativeTime } from '../lib/status';
import {
  ACCEPTED_EXTS,
  formatBytes,
  getDisplayName,
  inferBatchName,
  partitionBatchFiles,
  validateSingleFile,
} from '../lib/upload';
import type { TaskSummary } from '../types';

type UploadMode = 'single' | 'batch';
type UploadState = 'idle' | 'selected' | 'uploading' | 'error';

export function UploadPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<UploadMode>('single');
  const [file, setFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchInvalid, setBatchInvalid] = useState<{ name: string; reason: string }[]>([]);
  const [batchName, setBatchName] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const [recentTasks, setRecentTasks] = useState<TaskSummary[]>([]);
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);
  const singleInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const refreshRecent = useCallback(() => {
    listTasks({ limit: 5 })
      .then((res) => setRecentTasks(res.items.slice(0, 5)))
      .catch(() => {
        // 忽略最近任务加载失败
      });
  }, []);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  const resetSelection = () => {
    setFile(null);
    setBatchFiles([]);
    setBatchInvalid([]);
    setBatchName('');
    setErrorMsg('');
    setUploadState('idle');
    if (singleInputRef.current) singleInputRef.current.value = '';
    if (batchInputRef.current) batchInputRef.current.value = '';
  };

  const switchMode = (next: UploadMode) => {
    if (uploadState === 'uploading') return;
    setMode(next);
    resetSelection();
  };

  const handleSingleFile = (f: File) => {
    const err = validateSingleFile(f);
    if (err) {
      setErrorMsg(err);
      setUploadState('error');
      setFile(null);
    } else {
      setFile(f);
      setErrorMsg('');
      setUploadState('selected');
    }
  };

  const handleBatchFiles = (rawFiles: FileList | File[]) => {
    const list = Array.from(rawFiles);
    if (list.length === 0) return;

    const { valid, invalid } = partitionBatchFiles(list);
    setBatchFiles(valid);
    setBatchInvalid(
      invalid.map((item) => ({
        name: getDisplayName(item.file),
        reason: item.reason,
      }))
    );
    setBatchName((prev) => prev.trim() || inferBatchName(valid.length > 0 ? valid : list));
    setErrorMsg(valid.length === 0 ? '未找到有效 PDF 文件' : '');
    setUploadState(valid.length > 0 ? 'selected' : 'error');
  };

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length === 0) return;

      if (mode === 'single') {
        handleSingleFile(dropped[0]);
      } else {
        handleBatchFiles(dropped);
      }
    },
    [mode]
  );

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onSingleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleSingleFile(f);
  };

  const onBatchInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleBatchFiles(files);
  };

  const handleSubmitSingle = async () => {
    if (!file) return;
    setUploadState('uploading');
    setErrorMsg('');
    try {
      const res = await uploadDocument(file);
      const uploadedName = file.name;
      setLastTaskId(res.task_id);
      resetSelection();
      refreshRecent();
      toast.success('上传成功', {
        description: `\u300c${uploadedName}\u300d已加入处理队列`,
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '上传失败，请重试';
      setErrorMsg(message);
      setUploadState('selected');
      toast.error('上传失败', { description: message });
    }
  };

  const handleSubmitBatch = async () => {
    if (batchFiles.length === 0) return;
    setUploadState('uploading');
    setErrorMsg('');
    try {
      const res = await uploadBatch(
        batchFiles,
        batchName.trim() || undefined
      );
      const accepted = res.accepted;
      resetSelection();
      refreshRecent();
      toast.success('批量上传成功', {
        description: `${accepted} 个文件已提交，最多 3 个并发处理`,
      });
      navigate(`/batches/${res.batch_id}`, {
        state: { rejected: res.rejected },
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '批量上传失败，请重试';
      setErrorMsg(message);
      setUploadState('selected');
      toast.error('批量上传失败', { description: message });
    }
  };

  const canSubmit =
    mode === 'single'
      ? Boolean(file) && uploadState !== 'uploading'
      : batchFiles.length > 0 && uploadState !== 'uploading';

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">上传研报</h2>
        <p className="mt-1 text-sm text-stone-500">
          仅支持 PDF，上传后自动解析并提取字段
        </p>
      </div>

      <div className="mb-4 inline-flex rounded-xl border border-stone-200/70 bg-white/90 p-1 shadow-sm">
        <button
          type="button"
          onClick={() => switchMode('single')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            mode === 'single'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-stone-100'
          }`}
          aria-pressed={mode === 'single'}
        >
          单文件
        </button>
        <button
          type="button"
          onClick={() => switchMode('batch')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            mode === 'batch'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-stone-100'
          }`}
          aria-pressed={mode === 'batch'}
        >
          批量
        </button>
      </div>

      <div className="rounded-2xl border border-stone-200/70 bg-white/90 p-6 shadow-md">
        <div
          role="button"
          tabIndex={0}
          aria-label={
            mode === 'single'
              ? '拖拽或点击上传单个文件'
              : '拖拽或点击选择文件夹或文件'
          }
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() =>
            mode === 'single'
              ? singleInputRef.current?.click()
              : batchInputRef.current?.click()
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              mode === 'single'
                ? singleInputRef.current?.click()
                : batchInputRef.current?.click();
            }
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
            dragging
              ? 'border-teal-400 bg-teal-50'
              : 'border-stone-300 hover:border-teal-400 hover:bg-stone-50'
          }`}
        >
          {mode === 'single' ? (
            <UploadCloud
              className={`mb-3 h-10 w-10 ${dragging ? 'text-teal-500' : 'text-stone-400'}`}
              aria-hidden="true"
            />
          ) : (
            <FolderOpen
              className={`mb-3 h-10 w-10 ${dragging ? 'text-teal-500' : 'text-stone-400'}`}
              aria-hidden="true"
            />
          )}
          <p className="text-sm font-medium text-slate-700">
            {mode === 'single' ? '拖拽文件到此处' : '拖拽文件夹或文件到此处'}
          </p>
          <p className="mt-1 text-xs text-stone-500">或</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              mode === 'single'
                ? singleInputRef.current?.click()
                : batchInputRef.current?.click();
            }}
            className="mt-3 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            {mode === 'single' ? '选择文件' : '选择文件夹'}
          </button>
          <p className="mt-3 text-xs text-stone-400">
            {mode === 'single'
              ? `仅 PDF · 最大 ${50}MB`
              : `仅 PDF · 最多 100 个 · 最多 3 个并发 · 最大 ${50}MB`}
          </p>
        </div>

        <input
          ref={singleInputRef}
          type="file"
          accept={ACCEPTED_EXTS.join(',')}
          className="hidden"
          aria-label="选择单个文件"
          onChange={onSingleInputChange}
        />
        <input
          ref={batchInputRef}
          type="file"
          accept={ACCEPTED_EXTS.join(',')}
          className="hidden"
          aria-label="选择文件夹或多个文件"
          multiple
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          onChange={onBatchInputChange}
        />

        {(errorMsg || uploadState === 'error') && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {errorMsg}
          </div>
        )}

        {mode === 'single' && file && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <File className="h-4 w-4 text-teal-500" aria-hidden="true" />
              <span className="max-w-xs truncate text-sm text-slate-700">{file.name}</span>
              <span className="text-xs text-stone-400">{formatBytes(file.size)}</span>
            </div>
            <button
              aria-label="移除文件"
              onClick={resetSelection}
              className="ml-2 text-stone-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {mode === 'batch' && batchFiles.length > 0 && (
          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="batch-name"
                className="mb-1.5 block text-xs font-medium text-slate-700"
              >
                批次名称
              </label>
              <input
                id="batch-name"
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="如 2024Q3 研报"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Files className="h-4 w-4 text-teal-500" aria-hidden="true" />
                共 {batchFiles.length} 个文件
                {batchInvalid.length > 0 && (
                  <span className="text-xs font-normal text-amber-700">
                    · {batchInvalid.length} 个无效
                  </span>
                )}
              </div>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
                {batchFiles.slice(0, 8).map((f) => (
                  <li key={getDisplayName(f)} className="truncate">
                    {getDisplayName(f)} · {formatBytes(f.size)}
                  </li>
                ))}
                {batchFiles.length > 8 && (
                  <li className="text-stone-400">还有 {batchFiles.length - 8} 个…</li>
                )}
              </ul>
            </div>

            {batchInvalid.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <p className="font-medium">以下文件无法上传：</p>
                <ul className="mt-1 space-y-0.5">
                  {batchInvalid.slice(0, 5).map((item) => (
                    <li key={item.name}>
                      {item.name} — {item.reason}
                    </li>
                  ))}
                  {batchInvalid.length > 5 && (
                    <li>还有 {batchInvalid.length - 5} 个</li>
                  )}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={resetSelection}
              className="text-xs text-stone-500 hover:text-slate-700"
            >
              清空选择
            </button>
          </div>
        )}

        <button
          disabled={!canSubmit}
          onClick={mode === 'single' ? handleSubmitSingle : handleSubmitBatch}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          aria-busy={uploadState === 'uploading'}
        >
          {uploadState === 'uploading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              上传中…
            </>
          ) : mode === 'single' ? (
            '开始上传'
          ) : (
            `批量上传 ${batchFiles.length || 0} 个文件`
          )}
        </button>
      </div>

      {lastTaskId && mode === 'single' && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          上传成功，任务已创建
          <Link
            to={`/tasks/${lastTaskId}`}
            className="ml-2 font-medium text-emerald-900 underline underline-offset-2"
          >
            查看任务详情
          </Link>
          <span className="mx-1 text-emerald-600">·</span>
          <Link to="/tasks" className="font-medium text-emerald-900 underline underline-offset-2">
            任务列表
          </Link>
        </div>
      )}

      {recentTasks.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
            最近任务
          </h3>
          <div className="space-y-2">
            {recentTasks.map((task) => (
              <Link
                key={task.id}
                to={
                  task.batch_id
                    ? `/batches/${task.batch_id}`
                    : `/tasks/${task.id}`
                }
                className="flex items-center justify-between rounded-xl border border-stone-200/70 bg-white/90 px-4 py-3 text-sm transition hover:border-teal-300 hover:bg-teal-50"
              >
                <span className="min-w-0 truncate font-medium text-slate-700">
                  {task.company_name
                    ? `${task.company_name}${task.stock_code ? ` \u00b7 ${task.stock_code}` : ''}`
                    : task.relative_path ?? task.source_file}
                </span>
                <span className="ml-3 shrink-0 text-xs text-stone-400">
                  {formatRelativeTime(task.updated_at)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
