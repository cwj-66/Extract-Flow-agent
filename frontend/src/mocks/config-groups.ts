import type { GroupsConfig } from '../types';

export const DEFAULT_GROUPS_CONFIG: GroupsConfig = {
  groups: [
    {
      id: 'oc_investment_research',
      name: '投研内部群',
      webhook_url: 'https://open.feishu.cn/open-apis/bot/v2/hook/mock-xxx',
      document_type: 'broker_report_review',
      is_default: true,
    },
    {
      id: 'oc_equity_daily',
      name: '权益日报群',
      webhook_url: 'https://open.feishu.cn/open-apis/bot/v2/hook/mock-yyy',
      document_type: 'broker_report_review',
      is_default: false,
    },
  ],
};
