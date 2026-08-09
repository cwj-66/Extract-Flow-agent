import type { ExtractionFields } from '../types';

export const MOCK_EXTRACTION: Record<string, ExtractionFields> = {
  'mock-task-001': {
    company_name: '中信证券',
    stock_code: '600030.SH',
    report_period: '2026Q1',
    rating: '优于大市',
    revenue: { value: '231.55亿元', change: '同比+40.91%' },
    net_profit: { value: '102.16亿元', change: '同比+54.60%' },
    roe: { value: '3.46%', change: '' },
    total_assets: { value: '2.24万亿元', change: '较年初+7.82%' },
    net_assets: { value: '5000亿元', change: '较年初+5.00%' },
    business_segments: [
      { name: '经纪业务', value: '49.15亿元', growth: '同比+47.82%' },
      { name: '投资业务', value: '116.79亿元', growth: '核心增量来源' },
      { name: '资管业务', value: '35.05亿元', growth: '同比+36.74%' },
    ],
    profit_forecast: [
      { year: '2026E', revenue: '84,746', net_profit: '36,392' },
      { year: '2027E', revenue: '90,120', net_profit: '38,800' },
      { year: '2028E', revenue: '95,300', net_profit: '41,200' },
    ],
    core_view: '作为行业龙头，受益于注册制改革深化和资本市场繁荣，市占率持续提升',
    risks: '市场大幅波动导致自营及衍生品业务亏损；监管政策趋严压制费率空间',
  },
  'mock-task-003': {
    company_name: '宁德时代',
    stock_code: '300750.SZ',
    report_period: '2025全年',
    rating: '增持',
    revenue: { value: '4000.00亿元', change: '同比+25.30%' },
    net_profit: { value: '520.00亿元', change: '同比+18.50%' },
    roe: { value: '22.10%', change: '' },
    total_assets: { value: '8500.00亿元', change: '较年初+15.40%' },
    net_assets: { value: '3200.00亿元', change: '较年初+12.00%' },
    business_segments: [
      { name: '动力电池', value: '市占率38%', growth: '全球第一' },
      { name: '储能', value: '高速成长', growth: '第二增长曲线' },
    ],
    profit_forecast: [
      { year: '2026E', revenue: '480,000', net_profit: '62,000' },
      { year: '2027E', revenue: '550,000', net_profit: '72,000' },
      { year: '2028E', revenue: '620,000', net_profit: '82,000' },
    ],
    core_view: '技术壁垒深厚，先进产能引领行业；客户结构多元，绑定全球主流车企',
    risks: '新能源车销量不及预期；原材料价格大幅波动；海外贸易壁垒风险',
  },
};

export const MOCK_MARKDOWN: Record<string, string> = {
  'mock-task-001': `# 中信证券（600030.SH）2026 年一季度业绩点评

## 摘要

中信证券 2026 年一季度实现营业收入 231.55 亿元，同比增长 40.91%。`,
};
