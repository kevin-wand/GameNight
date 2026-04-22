import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

/**
 * Updated on every push/pop so a class ErrorBoundary can read it synchronously in componentDidCatch (Step 2).
 */
export const modalSurfacesSnapshotRef: { current: readonly string[] } = { current: [] };

type RegistrationContextValue = {
  push: (id: string) => void;
  popId: (id: string) => void;
};

const ModalSurfaceRegistrationContext = createContext<RegistrationContextValue | undefined>(
  undefined
);

/**
 * Tracks which modal / overlay surfaces are currently mounted as "active".
 * Nested surfaces: push on open, pop by id on close (removes last occurrence of id).
 */
export function ModalSurfaceProvider({ children }: { children: React.ReactNode }) {
  const stackRef = useRef<string[]>([]);

  const syncSnapshot = useCallback(() => {
    modalSurfacesSnapshotRef.current = [...stackRef.current];
  }, []);

  const push = useCallback(
    (id: string) => {
      stackRef.current = [...stackRef.current, id];
      syncSnapshot();
    },
    [syncSnapshot]
  );

  const popId = useCallback(
    (id: string) => {
      const s = stackRef.current;
      const idx = s.lastIndexOf(id);
      if (idx === -1) return;
      stackRef.current = [...s.slice(0, idx), ...s.slice(idx + 1)];
      syncSnapshot();
    },
    [syncSnapshot]
  );

  const value = useMemo(() => ({ push, popId }), [push, popId]);

  return (
    <ModalSurfaceRegistrationContext.Provider value={value}>
      {children}
    </ModalSurfaceRegistrationContext.Provider>
  );
}

/**
 * Register a modal (or overlay) surface while `active` is true.
 * Uses stack semantics: opens push, cleanup pops that id (last occurrence).
 */
export function useRegisterModalSurface(id: string, active: boolean): void {
  const ctx = useContext(ModalSurfaceRegistrationContext);
  if (!ctx) {
    throw new Error('useRegisterModalSurface must be used within ModalSurfaceProvider');
  }

  useEffect(() => {
    if (!active) return;
    ctx.push(id);
    return () => {
      ctx.popId(id);
    };
  }, [id, active, ctx]);
}
