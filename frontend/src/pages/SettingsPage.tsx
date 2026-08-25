import { PageHeader } from '../components/layout/PageHeader';
import { GeneralSettingsSection } from '../components/settings/GeneralSettingsSection';
import { AboutSection } from '../components/settings/AboutSection';

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="设置"
        description="工作台偏好与版本信息。飞书发送目标请到「飞书通知」里配置。"
      />

      <div className="space-y-4">
        <section className="ef-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink">偏好</h2>
          <GeneralSettingsSection />
        </section>

        <section className="ef-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink">关于</h2>
          <AboutSection />
        </section>
      </div>
    </div>
  );
}
