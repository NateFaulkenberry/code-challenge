import { useState } from "react";
import { NavLink, Outlet, ScrollRestoration } from "react-router";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Notice } from "@/components/Notice";
import { GenerateDialog } from "@/features/generation/GenerateDialog";
import { useChallengeSource, useServices } from "./context";
import styles from "./Layout.module.css";
import { useUnsavedChanges } from "./unsaved-changes";

export function Layout() {
  const { storageWarning } = useServices();
  const source = useChallengeSource();
  const unsaved = useUnsavedChanges();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const status = source.status();

  const openGenerate = () => {
    if (unsaved.isDirty()) setConfirmDiscard(true);
    else setGenerateOpen(true);
  };

  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand} aria-label="Coding Challenge Lab — home">
          <span className={styles.logo} aria-hidden="true">
            {"</>"}
          </span>
          <span className={styles.wordmark}>
            Challenge<span>Lab</span>
          </span>
        </NavLink>
        <nav aria-label="Primary" className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => (isActive ? styles.active : undefined)}>
            Dashboard
          </NavLink>
          <NavLink
            to="/challenges"
            className={({ isActive }) => (isActive ? styles.active : undefined)}
          >
            My Challenges
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => (isActive ? styles.active : undefined)}
          >
            Settings
          </NavLink>
        </nav>
        <div className={styles.actions}>
          <span
            className={`${styles.provider} ${status.state === "ready" ? styles.ready : styles.unconfigured}`}
            title={status.state === "ready" ? `Generation source: ${status.label}` : status.reason}
          >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.providerLabel}>{status.label}</span>
          </span>
          <Button variant="primary" onClick={openGenerate}>
            New challenge
          </Button>
        </div>
      </header>
      {storageWarning && (
        <div className={styles.banner}>
          <Notice tone="warning" title="Storage unavailable">
            {storageWarning}
          </Notice>
        </div>
      )}
      <main id="main" className={styles.main} tabIndex={-1}>
        <Outlet context={{ openGenerate }} />
      </main>
      <GenerateDialog open={generateOpen} onClose={() => setGenerateOpen(false)} />
      <ConfirmDialog
        open={confirmDiscard}
        title="You have unsaved changes"
        confirmLabel="Discard and continue"
        tone="danger"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          unsaved.setDirty(false);
          setConfirmDiscard(false);
          setGenerateOpen(true);
        }}
      >
        Your current solution has changes that haven&apos;t been saved. Generate a new challenge
        anyway?
      </ConfirmDialog>
      <ScrollRestoration />
    </div>
  );
}

export interface LayoutOutletContext {
  openGenerate: () => void;
}
