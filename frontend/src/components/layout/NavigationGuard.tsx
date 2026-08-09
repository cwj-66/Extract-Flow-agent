import { useCallback, useEffect, useMemo } from 'react';
import { useBlocker, useBeforeUnload, useLocation } from 'react-router-dom';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useMockStore } from '../../store/mockStore';

export function NavigationGuard() {
  const location = useLocation();
  const groupsConfigDirty = useMockStore((s) => s.groupsConfigDirty);

  const dirtyOnCurrentPage = useMemo(() => {
    if (location.pathname === '/config/groups') return groupsConfigDirty;
    return false;
  }, [location.pathname, groupsConfigDirty]);

  const shouldBlock = useCallback(
    ({
      currentLocation,
      nextLocation,
    }: {
      currentLocation: { pathname: string };
      nextLocation: { pathname: string };
    }) => {
      if (currentLocation.pathname !== '/config/groups') return false;
      if (currentLocation.pathname === nextLocation.pathname) return false;
      return groupsConfigDirty;
    },
    [groupsConfigDirty]
  );

  const blocker = useBlocker(shouldBlock);

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!dirtyOnCurrentPage) return;
        event.preventDefault();
      },
      [dirtyOnCurrentPage]
    )
  );

  useEffect(() => {
    if (blocker.state === 'blocked' && !dirtyOnCurrentPage) {
      blocker.reset();
    }
  }, [blocker, dirtyOnCurrentPage]);

  const leaveOpen = blocker.state === 'blocked';

  return (
    <ConfirmDialog
      open={leaveOpen}
      title="群配置尚未保存"
      description="离开当前页面将丢失未保存的修改，是否继续？"
      confirmLabel="离开"
      cancelLabel="留在此页"
      tone="danger"
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    />
  );
}
