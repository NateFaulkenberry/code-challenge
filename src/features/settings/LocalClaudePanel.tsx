import { useState } from "react";
import { useLocalClaude, useServices } from "@/app/context";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { LOCAL_CLAUDE_LABEL } from "@/services/generation/local-claude";
import styles from "./SettingsPage.module.css";

/** Status and setup guidance for the local-only Claude integration (development builds only). */
export function LocalClaudePanel() {
  const availability = useLocalClaude();
  const { localClaude } = useServices();
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    setChecking(true);
    await localClaude.refresh();
    setChecking(false);
  };

  const status = availability.kind === "known" ? availability.status : undefined;
  const ready = status?.state === "ready";

  return (
    <div className={styles.localClaude}>
      <div className={styles.inline}>
        <Badge tone="info">{LOCAL_CLAUDE_LABEL}</Badge>
        <Badge tone={ready ? "success" : "warning"}>
          {ready
            ? `Ready · ${status.subscription ?? "subscription"}`
            : availability.kind === "checking"
              ? "Checking…"
              : "Not ready"}
        </Badge>
        <Button size="sm" variant="ghost" busy={checking} onClick={() => void recheck()}>
          Re-check
        </Button>
      </div>
      <p className={styles.description}>
        Runs Claude through the official Claude Agent SDK on your local dev server, signed in with
        your own Claude subscription. No API key is used and nothing is sent from this page except
        to your local server. Usage counts toward your plan&apos;s limits. This option doesn&apos;t
        exist on the published site.
      </p>
      {!ready && (
        <Notice tone="warning" title="Local Claude isn't ready">
          {availability.kind === "known"
            ? availability.status.message
            : availability.kind === "unreachable"
              ? availability.message
              : "Checking…"}{" "}
          See <code>docs/local-claude.md</code>: run <code>npm run claude:check</code>, then start
          the app with <code>npm run dev:claude</code>.
        </Notice>
      )}
    </div>
  );
}
