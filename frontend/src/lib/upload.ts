export const ACCEPTED_EXTS = ['.pdf'];
export const MAX_SIZE_MB = 50;
export const MAX_BATCH_FILES = 100;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function getFileExt(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? name;
  const dot = base.lastIndexOf('.');
  if (dot === -1) return '';
  return base.slice(dot).toLowerCase();
}

export function getDisplayName(file: File): string {
  const relative =
    'webkitRelativePath' in file && file.webkitRelativePath
      ? file.webkitRelativePath
      : file.name;
  return relative.replace(/\\/g, '/');
}

export function validateSingleFile(file: File): string | null {
  const ext = getFileExt(file.name);
  if (!ACCEPTED_EXTS.includes(ext)) {
    return `不支持的文件格式（${ext || '无扩展名'}），请上传 PDF`;
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `文件超过 ${MAX_SIZE_MB}MB 限制`;
  }
  return null;
}

export interface InvalidBatchFile {
  file: File;
  reason: string;
}

export function partitionBatchFiles(files: File[]): {
  valid: File[];
  invalid: InvalidBatchFile[];
} {
  const valid: File[] = [];
  const invalid: InvalidBatchFile[] = [];

  for (const file of files) {
    const display = getDisplayName(file);
    const ext = getFileExt(display);
    if (!ACCEPTED_EXTS.includes(ext)) {
      invalid.push({
        file,
        reason: `不支持的文件类型: ${ext || '(无扩展名)'}`,
      });
      continue;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      invalid.push({
        file,
        reason: `超过 ${MAX_SIZE_MB}MB 限制`,
      });
      continue;
    }
    valid.push(file);
  }

  if (valid.length > MAX_BATCH_FILES) {
    const overflow = valid.splice(MAX_BATCH_FILES);
    for (const file of overflow) {
      invalid.push({ file, reason: `超出单次最多 ${MAX_BATCH_FILES} 个文件` });
    }
  }

  return { valid, invalid };
}

export function inferBatchName(files: File[]): string {
  const first = files[0];
  if (!first) return 'batch';
  const path = getDisplayName(first);
  const parts = path.split('/');
  if (parts.length > 1) return parts[0];
  return `batch-${files.length}files`;
}
