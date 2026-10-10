import { MessageSquare } from 'lucide-react';
import { GroupsConfigSection } from '../components/settings/GroupsConfigSection';

export function FeishuGroupsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="ef-card p-6">
        <div className="mb-5 flex items-start gap-3 rounded-lg bg-brand-soft px-4 py-3">
          <div className="ef-icon-tile bg-white text-brand">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="text-xs leading-relaxed text-muted">
            显示名称只用于本页下拉选择，不必和飞书群名完全一致。未指定群时走默认项。
            飞书开放平台说明见
            {' '}
            <a
              href="https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand hover:underline"
            >
              自定义机器人
            </a>
            。
          </p>
        </div>
        <GroupsConfigSection />
      </div>
    </div>
  );
}
