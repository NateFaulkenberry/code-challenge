import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

interface UnsavedChanges {
  /** Registers whether the current view has unsaved edits. */
  setDirty: (dirty: boolean) => void;
  isDirty: () => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChanges>({
  setDirty: () => undefined,
  isDirty: () => false,
});

/**
 * Lets actions outside the workspace (e.g. "New challenge" in the header)
 * ask before discarding edits, without coupling them to workspace state.
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const dirty = useRef(false);
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const isDirty = useCallback(() => dirty.current, []);
  const value = useMemo(() => ({ setDirty, isDirty }), [setDirty, isDirty]);
  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}

export function useUnsavedChanges(): UnsavedChanges {
  return useContext(UnsavedChangesContext);
}
