export const EVENT_LABELS: Record<string, string> = {
  task_uploaded: '已上传',
  parse_failed: '解析失败',
  fields_extracted: '提取完成',
  extraction_failed: '提取失败',
  field_edited: '修改字段',
  task_sent: '已发送',
  send_failed: '发送失败',
  export_completed: '已导出',
  export_failed: '导出失败',
  demo_seeded: '载入样例',
};

export function eventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType;
}

export const EVENT_FILTER_GROUPS = [
  { label: '上传', types: ['task_uploaded'] },
  { label: '提取', types: ['fields_extracted', 'parse_failed', 'extraction_failed'] },
  { label: '修改', types: ['field_edited'] },
  { label: '发送', types: ['task_sent', 'send_failed'] },
  { label: '导出', types: ['export_completed', 'export_failed'] },
  { label: '样例', types: ['demo_seeded'] },
];
