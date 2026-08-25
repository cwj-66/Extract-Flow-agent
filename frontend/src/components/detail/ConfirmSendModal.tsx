import { useEffect, useState } from 'react';
import { X, Send } from 'lucide-react';
import { toast } from 'sonner';
import { confirmTask } from '../../api/tasks';
import { ApiError } from '../../api/client';
import { fetchGroupsConfig } from '../../api/config';
import { useMockStore } from '../../store/mockStore';
import type { ExtractionFields, GroupConfig, TaskStatus } from '../../types';

interface ConfirmSendModalProps {
  taskId: string;
  companyName?: string | null;
  fields?: ExtractionFields;
  onClose: () => void;
  onSent: (status: TaskStatus) => void;
}

export function ConfirmSendModal({
  taskId,
  companyName,
  fields,
  onClose,
  onSent,
}: ConfirmSendModalProps) {
  const saveGroupsConfig = useMockStore((s) => s.saveGroupsConfig);
  const [groups, setGroups] = useState<GroupConfig[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchGroupsConfig();
        if (cancelled) return;
        setGroups(cfg.groups);
        saveGroupsConfig(cfg);
        const def = cfg.groups.find((g) => g.is_default) ?? cfg.groups[0];
        setSelectedGroupId(def?.id ?? '');
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof ApiError ? err.message : '加载群配置失败';
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [saveGroupsConfig]);

  const handleSend = async () => {
    if (!selectedGroupId) {
      toast.error('请选择目标群');
      return;
    }
    setSending(true);
    try {
      const res = await confirmTask(taskId, {
        fields: fields ?? null,
        group_id: selectedGroupId,
      });
      const group = groups.find((g) => g.id === selectedGroupId);
      toast.success('已发送到飞书', {
        description: `目标群「${group?.name ?? selectedGroupId}」`,
      });
      onSent(res.status);
      onClose();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '确认发送失败';
      toast.error('发送失败', { description: message });
      onSent('failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-send-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="confirm-send-title" className="text-sm font-semibold text-slate-900">
            确认发送到飞书
          </h2>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm text-slate-600">
            将发送
            {companyName ? <strong className="text-slate-900">「{companyName}」</strong> : '当前'}
            研报摘要到所选飞书群。
          </p>

          <div>
            <label
              htmlFor="group-select"
              className="mb-1.5 block text-xs font-medium text-slate-700"
            >
              目标群
            </label>
            <select
              id="group-select"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              disabled={loading}
              className="ef-input"
            >
              <option value="">{loading ? '加载中…' : '请选择群'}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.is_default ? '（默认）' : ''}
                </option>
              ))}
            </select>
            {!loading && groups.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-600">
                请先在「飞书通知」中添加 Webhook 并保存
              </p>
            )}
          </div>

          <p className="text-xs text-slate-400">
            将提交当前编辑字段并立即发送飞书 Card。
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            取消
          </button>
          <button
            onClick={handleSend}
            disabled={sending || loading || !selectedGroupId}
            className="ef-btn ef-btn-primary"
            aria-busy={sending}
          >
            {sending ? (
              '发送中…'
            ) : (
              <>
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                发送
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
