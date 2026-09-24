import type { ReactNode } from "react";
import styles from "./Notice.module.css";

export interface NoticeProps {
  tone?: "info" | "success" | "warning" | "danger";
  title: string;
  children?: ReactNode;
  /** Technical details, collapsed by default — never the primary message. */
  details?: string;
  action?: ReactNode;
}

export function Notice({ tone = "info", title, children, details, action }: NoticeProps) {
  return (
    <div
      className={`${styles.notice} ${styles[tone]}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.body}>{children}</div>}
        {details && (
          <details className={styles.details}>
            <summary>Technical details</summary>
            <pre>{details}</pre>
          </details>
        )}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
