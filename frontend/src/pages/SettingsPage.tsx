import { GeneralSettingsSection } from '../components/settings/GeneralSettingsSection';
import { AboutSection } from '../components/settings/AboutSection';
import { ProcessingRulesSection } from '../components/settings/ProcessingRulesSection';
import { useWorkspace } from '../components/layout/useWorkspace';

export function SettingsPage() {
  const { health } = useWorkspace();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="space-y-4">
        <section className="ef-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink">偏好</h2>
          <GeneralSettingsSection />
        </section>

        <ProcessingRulesSection health={health} />

        <section className="ef-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink">关于</h2>
          <AboutSection />
        </section>
      </div>
    </div>
  );
}
