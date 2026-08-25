import { getApiBaseUrl } from '../../api/client';

const APP_VERSION = '0.1.0';

export function AboutSection() {
  const docsUrl = `${getApiBaseUrl()}/docs`;

  return (
    <div className="space-y-3 text-sm text-muted">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-ink">萃报</span>
        <span className="rounded bg-canvas px-1.5 py-0.5 text-xs font-medium text-muted">
          v{APP_VERSION}
        </span>
      </div>
      <p>上传券商研报 PDF，本地 MinerU 解析 + Schema 提取，确认后推送飞书 Card v2。</p>
      <p>
        API 文档：
        <a
          href={docsUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-1 text-brand hover:underline"
        >
          {docsUrl}
        </a>
      </p>
      <p className="text-xs text-subtle">
        模型密钥在服务端环境变量中配置；飞书 Webhook 在「飞书通知」页维护。
      </p>
    </div>
  );
}
