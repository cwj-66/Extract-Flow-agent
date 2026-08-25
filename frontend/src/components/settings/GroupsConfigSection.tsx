import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { fetchGroupsConfig, saveGroupsConfig } from '../../api/config';
import { useMockStore } from '../../store/mockStore';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { isSameConfigSnapshot } from '../../utils/configDirty';
import type { GroupConfig } from '../../types';

export function GroupsConfigSection() {
  const cachedGroups = useMockStore((s) => s.groupsConfig.groups);
  const saveLocalGroups = useMockStore((s) => s.saveGroupsConfig);
  const setGroupsConfigDirty = useMockStore((s) => s.setGroupsConfigDirty);
  const [groups, setGroups] = useState<GroupConfig[]>(() => cachedGroups);
  const [savedGroups, setSavedGroups] = useState<GroupConfig[]>(() => cachedGroups);
  const [visibleWebhooks, setVisibleWebhooks] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const dirty = useMemo(
    () => !isSameConfigSnapshot(groups, savedGroups),
    [groups, savedGroups]
  );

  useEffect(() => {
    setGroupsConfigDirty(dirty);
  }, [dirty, setGroupsConfigDirty]);

  useEffect(() => {
    return () => setGroupsConfigDirty(false);
  }, [setGroupsConfigDirty]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchGroupsConfig();
        if (cancelled) return;
        setGroups(cfg.groups);
        setSavedGroups(cfg.groups);
        saveLocalGroups(cfg);
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
  }, [saveLocalGroups]);

  const toggleWebhook = (id: string) => {
    setVisibleWebhooks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addGroup = () => {
    const newGroup: GroupConfig = {
      id: `group_${Date.now()}`,
      name: '',
      webhook_url: '',
      document_type: 'broker_report_review',
      is_default: groups.length === 0,
    };
    setGroups((g) => [...g, newGroup]);
  };

  const updateGroup = (id: string, patch: Partial<GroupConfig>) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const updated = { ...g, ...patch };
        if (patch.is_default && updated.is_default) {
          return updated;
        }
        return updated;
      })
    );
    if (patch.is_default) {
      setGroups((prev) =>
        prev.map((g) => ({ ...g, is_default: g.id === id }))
      );
    }
  };

  const confirmDelete = (id: string) => setDeleteTarget(id);

  const deleteGroup = () => {
    if (!deleteTarget) return;
    setGroups((prev) => {
      const filtered = prev.filter((g) => g.id !== deleteTarget);
      if (filtered.length > 0 && !filtered.some((g) => g.is_default)) {
        filtered[0] = { ...filtered[0], is_default: true };
      }
      return filtered;
    });
    setDeleteTarget(null);
  };

  const save = async () => {
    if (groups.some((g) => !g.name.trim() || !g.webhook_url.trim())) {
      toast.error('请填写所有项的显示名称和 Webhook URL');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveGroupsConfig({ groups });
      saveLocalGroups(saved);
      setGroups(saved.groups);
      setSavedGroups(saved.groups);
      toast.success('已保存', { description: '确认发送时将使用对应 Webhook' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '保存失败';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted">加载群配置…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="ef-btn ef-btn-primary"
          >
            {saving ? '保存中…' : '保存'}
          </button>
          <button
            type="button"
            onClick={addGroup}
            className="ef-btn ef-btn-secondary"
          >
            <Plus className="h-3.5 w-3.5" />
            添加群
          </button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-canvas py-12 text-center text-sm text-subtle">
          暂无发送目标，点击「添加群」开始
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.id}
              className="rounded-xl border border-line bg-canvas/60 p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    显示名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                    placeholder="如：投研内部群"
                    className="ef-input"
                  />
                  <p className="mt-1 text-[11px] text-subtle">仅用于下拉选择，与飞书群名无强制对应</p>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Webhook URL <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={visibleWebhooks.has(group.id) ? 'text' : 'password'}
                      value={group.webhook_url}
                      onChange={(e) => updateGroup(group.id, { webhook_url: e.target.value })}
                      placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                      className="ef-input pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => toggleWebhook(group.id)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-ink"
                      aria-label={visibleWebhooks.has(group.id) ? '隐藏' : '显示'}
                    >
                      {visibleWebhooks.has(group.id) ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                  <input
                    type="radio"
                    name="default-group"
                    checked={group.is_default}
                    onChange={() => updateGroup(group.id, { is_default: true })}
                    className="accent-brand"
                  />
                  设为默认群
                </label>
                <button
                  type="button"
                  onClick={() => confirmDelete(group.id)}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-red-500 transition hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除群配置"
        description="删除后不可恢复，是否继续？"
        confirmLabel="删除"
        tone="danger"
        onConfirm={deleteGroup}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
