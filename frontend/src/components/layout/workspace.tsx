import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { fetchHealth, type HealthResponse } from '../../api/health';
import { ApiError } from '../../api/client';
import { listTasks, seedDemo } from '../../api/tasks';
import { WorkspaceContext } from './useWorkspace';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [healthRes, pending] = await Promise.all([
        fetchHealth().catch(() => null),
        listTasks({ status: 'pending_confirm', limit: 1 }).catch(() => null),
      ]);
      if (cancelled) return;
      setHealth(healthRes);
      setPendingCount(pending?.total ?? 0);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, location.pathname]);

  const loadSamples = useCallback(async () => {
    setSeeding(true);
    try {
      const created = await seedDemo();
      toast.success(
        created.length > 0
          ? `已载入 ${created.length} 份样例，可直接打开审阅`
          : '样例已在任务列表中'
      );
      setRefreshKey((key) => key + 1);
      navigate('/');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '载入样例失败');
    } finally {
      setSeeding(false);
    }
  }, [navigate]);

  const value = useMemo(
    () => ({ health, pendingCount, refreshKey, seeding, loadSamples }),
    [health, pendingCount, refreshKey, seeding, loadSamples]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
