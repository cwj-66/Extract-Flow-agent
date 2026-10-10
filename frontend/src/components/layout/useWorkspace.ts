import { createContext, useContext } from 'react';
import type { HealthResponse } from '../../api/health';

export interface WorkspaceState {
  health: HealthResponse | null;
  pendingCount: number;
  refreshKey: number;
  seeding: boolean;
  loadSamples: () => Promise<void>;
}

export const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function useWorkspace(): WorkspaceState {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error('useWorkspace 必须在 WorkspaceProvider 内使用');
  }
  return value;
}
