import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Tabs.module.css";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  badge?: ReactNode;
}

/** WAI-ARIA tabs: arrow keys move between tabs, only the active tab is in the tab order. */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
  children,
  actions,
}: {
  tabs: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  label: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const baseId = useId();
  const refs = useRef(new Map<T, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent) => {
    const index = tabs.findIndex((t) => t.id === active);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    const tab = tabs[next];
    if (!tab) return;
    event.preventDefault();
    onChange(tab.id);
    refs.current.get(tab.id)?.focus();
  };

  return (
    <div className={styles.container}>
      <div className={styles.bar}>
        <div role="tablist" aria-label={label} className={styles.list} onKeyDown={onKeyDown}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) refs.current.set(tab.id, el);
                else refs.current.delete(tab.id);
              }}
              role="tab"
              type="button"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={tab.id === active}
              aria-controls={`${baseId}-panel`}
              tabIndex={tab.id === active ? 0 : -1}
              className={styles.tab}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
              {tab.badge}
            </button>
          ))}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className={styles.panel}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}
