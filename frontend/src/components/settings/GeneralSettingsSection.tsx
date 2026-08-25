import { useState } from 'react';
import { toast } from 'sonner';
import { useMockStore } from '../../store/mockStore';

export function GeneralSettingsSection() {
  const saveGeneralSettings = useMockStore((s) => s.saveGeneralSettings);
  const generalSettings = useMockStore((s) => s.generalSettings);
  const [displayName, setDisplayName] = useState(
    generalSettings.userId === 'anonymous' ? '' : generalSettings.userId
  );
  const [pollIntervalSec, setPollIntervalSec] = useState(generalSettings.pollIntervalSec);

  const handleSave = () => {
    const next = {
      ...generalSettings,
      userId: displayName.trim() || 'anonymous',
      pollIntervalSec: Math.min(30, Math.max(1, Number(pollIntervalSec) || 3)),
    };
    saveGeneralSettings(next);
    setPollIntervalSec(next.pollIntervalSec);
    toast.success('偏好已保存');
  };

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="display-name" className="mb-1.5 block text-xs font-medium text-muted">
          显示名称
        </label>
        <input
          id="display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="可选，用于发送记录标识"
          className="ef-input max-w-sm"
        />
        <p className="mt-1 text-xs text-subtle">
          未填写时记为匿名。登录能力接入前，仅作本机标识。
        </p>
      </div>

      <div>
        <label htmlFor="poll-interval" className="mb-1.5 block text-xs font-medium text-muted">
          任务状态刷新间隔（秒）
        </label>
        <input
          id="poll-interval"
          type="number"
          min={1}
          max={30}
          value={pollIntervalSec}
          onChange={(e) => setPollIntervalSec(Number(e.target.value))}
          className="ef-input w-32"
        />
        <p className="mt-1 text-xs text-subtle">处理中的任务会按此间隔自动刷新状态。</p>
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="ef-btn ef-btn-primary"
      >
        保存偏好
      </button>
    </div>
  );
}
