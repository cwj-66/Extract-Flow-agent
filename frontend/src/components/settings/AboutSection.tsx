import { getApiBaseUrl } from '../../api/client';

const APP_VERSION = '0.1.0';

export function AboutSection() {
  const docsUrl = `${getApiBaseUrl()}/docs`;

  return (
    <div className="space-y-3 text-sm text-slate-600">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-slate-900">萃报</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          v{APP_VERSION}
        </span>
      </div>
      <p>上传券商研报 PDF，自动提取结构化字段，确认后推送到飞书群卡片。</p>
      <p>
        API 文档：
        <a
          href={docsUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-1 text-teal-700 hover:underline"
        >
          {docsUrl}
        </a>
      </p>
      <p className="text-xs text-slate-400">
        模型密钥在服务端环境变量中配置；飞书 Webhook 在「飞书通知」页维护。
      </p>
    </div>
  );
}
