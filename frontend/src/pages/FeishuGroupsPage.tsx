import { GroupsConfigSection } from '../components/settings/GroupsConfigSection';

export function FeishuGroupsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">飞书通知</h2>
        <p className="mt-1 text-sm text-slate-500">
          决定确认发送后卡片推送到哪些群。机器人 Webhook 可在飞书群设置中创建。
        </p>
      </header>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <GroupsConfigSection />
      </div>
    </div>
  );
}
