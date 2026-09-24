import { useId, useRef, useState } from "react";
import { useAttempts, useServices, useSettings } from "@/app/context";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Dialog } from "@/components/Dialog";
import { SelectField } from "@/components/Field";
import { Notice } from "@/components/Notice";
import {
  createBackup,
  createPortfolio,
  parseExportFile,
  planImport,
  type DuplicateStrategy,
  type ExportFile,
} from "@/domain/export-format";
import { downloadJson, timestampedName } from "@/utils/download";
import { pluralize } from "@/utils/format";
import styles from "./SettingsPage.module.css";

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

type ImportState =
  | { phase: "idle" }
  | { phase: "preview"; file: ExportFile; skipped: number; fileName: string }
  | { phase: "done"; message: string }
  | { phase: "error"; message: string; details?: string };

export function DataSection() {
  const { attempts: store } = useServices();
  const { attempts } = useAttempts();
  const { settings, update } = useSettings();
  const fileInput = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });
  const [strategy, setStrategy] = useState<DuplicateStrategy>("newest");
  const [confirmClear, setConfirmClear] = useState(false);
  const passedCount = attempts.filter((a) => a.status === "passed").length;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setImportState({
        phase: "error",
        message: "That file is too large to be a Coding Challenge Lab export (limit 20 MB).",
      });
      return;
    }
    const result = parseExportFile(await file.text());
    if (!result.ok)
      setImportState({
        phase: "error",
        message: result.error,
        ...(result.details ? { details: result.details } : {}),
      });
    else
      setImportState({
        phase: "preview",
        file: result.file,
        skipped: result.skipped,
        fileName: file.name,
      });
    if (fileInput.current) fileInput.current.value = "";
  };

  const confirmImport = async () => {
    if (importState.phase !== "preview") return;
    const plan = planImport(
      importState.file.attempts,
      new Map(attempts.map((a) => [a.id, a])),
      strategy,
    );
    try {
      await store.saveMany(plan.toWrite);
      if (importState.file.settings)
        update({ ...importState.file.settings, provider: settings.provider });
      setImportState({
        phase: "done",
        message: `Imported ${pluralize(plan.added, "new challenge")}, updated ${plan.updated}, skipped ${plan.skipped}.`,
      });
    } catch (error) {
      setImportState({
        phase: "error",
        message: "Import failed while saving.",
        details: String(error),
      });
    }
  };

  const preview = importState.phase === "preview" ? importState : undefined;
  const previewPlan =
    preview && planImport(preview.file.attempts, new Map(attempts.map((a) => [a.id, a])), strategy);

  return (
    <section className={styles.section} aria-labelledby="data-heading">
      <h2 id="data-heading">Data</h2>
      <p className={styles.description}>
        Your challenges live in this browser (
        {store.storageKind === "indexeddb" ? "IndexedDB" : "memory only — not persisted"}). Export a
        backup to move them between browsers. API keys are never included in exports.
      </p>

      <div className={styles.row}>
        <div>
          <h3>Backup</h3>
          <p className={styles.description}>
            All {pluralize(attempts.length, "challenge")}, solutions, results and settings.
          </p>
        </div>
        <Button
          onClick={() =>
            downloadJson(
              timestampedName("challenge-lab-backup"),
              createBackup(attempts, settings, new Date()),
            )
          }
          disabled={attempts.length === 0}
        >
          Export backup
        </Button>
      </div>

      <div className={styles.row}>
        <div>
          <h3>Portfolio</h3>
          <p className={styles.description}>
            Only the {pluralize(passedCount, "completed challenge")} with their passing solutions.
            Commit the file as <code>public/portfolio/portfolio.json</code> to publish it on your
            site.
          </p>
        </div>
        <Button
          onClick={() => downloadJson("portfolio.json", createPortfolio(attempts, new Date()))}
          disabled={passedCount === 0}
        >
          Export portfolio
        </Button>
      </div>

      <div className={styles.row}>
        <div>
          <h3>Import</h3>
          <p className={styles.description}>
            Restore a backup or portfolio export. The file is validated before anything is written.
          </p>
        </div>
        <div>
          <label htmlFor={inputId} className="visually-hidden">
            Choose an export file to import
          </label>
          <input
            ref={fileInput}
            id={inputId}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button onClick={() => fileInput.current?.click()}>Import file…</Button>
        </div>
      </div>

      {importState.phase === "done" && (
        <Notice tone="success" title="Import complete">
          {importState.message}
        </Notice>
      )}
      {importState.phase === "error" && (
        <Notice
          tone="danger"
          title="Import failed"
          {...(importState.details ? { details: importState.details } : {})}
        >
          {importState.message}
        </Notice>
      )}

      <div className={`${styles.row} ${styles.dangerRow}`}>
        <div>
          <h3>Clear local data</h3>
          <p className={styles.description}>
            Delete every challenge stored in this browser. Export a backup first.
          </p>
        </div>
        <Button
          variant="danger"
          onClick={() => setConfirmClear(true)}
          disabled={attempts.length === 0}
        >
          Clear all challenges
        </Button>
      </div>

      <Dialog
        open={preview !== undefined}
        title="Import challenges"
        onClose={() => setImportState({ phase: "idle" })}
        footer={
          <>
            <Button onClick={() => setImportState({ phase: "idle" })}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => void confirmImport()}
              disabled={!previewPlan || previewPlan.toWrite.length === 0}
            >
              Import
            </Button>
          </>
        }
      >
        {preview && previewPlan && (
          <div className={styles.importPreview}>
            <p>
              <strong>{preview.fileName}</strong> — {preview.file.kind} export from{" "}
              {new Date(preview.file.exportedAt).toLocaleString()}.
            </p>
            <ul>
              <li>{pluralize(previewPlan.added, "new challenge")}</li>
              <li>
                {pluralize(previewPlan.updated + previewPlan.skipped, "challenge")} already in this
                browser
              </li>
              {preview.skipped > 0 && (
                <li>
                  {pluralize(preview.skipped, "invalid entry", "invalid entries")} will be ignored
                </li>
              )}
            </ul>
            <SelectField
              label="When a challenge already exists"
              value={strategy}
              onChange={setStrategy}
              options={[
                { value: "newest", label: "Keep whichever was updated most recently" },
                { value: "skip", label: "Keep the existing copy" },
                { value: "overwrite", label: "Replace with the imported copy" },
              ]}
            />
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmClear}
        title="Delete all local challenges?"
        confirmLabel="Delete everything"
        tone="danger"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          void store.clear();
        }}
      >
        This permanently removes {pluralize(attempts.length, "challenge")} and their solutions from
        this browser. Published portfolio entries on the site are not affected.
      </ConfirmDialog>
    </section>
  );
}
