import { GeneralSettingsSection } from '../components/settings/GeneralSettingsSection';
import { AboutSection } from '../components/settings/AboutSection';

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">设置</h2>
        <p className="mt-1 text-sm text-slate-500">
          工作台偏好与版本信息。飞书发送目标请在「飞书通知」中配置。
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">偏好</h3>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <GeneralSettingsSection />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">关于</h3>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <AboutSection />
        </div>
      </section>
    </div>
  );
}
