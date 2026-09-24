import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useChallengeSource } from "@/app/context";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { SelectField, type SelectOption } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { Spinner } from "@/components/Spinner";
import { DIFFICULTY_LIST, type Difficulty } from "@/domain/difficulty";
import { LANGUAGE_LIST, type LanguageId } from "@/domain/languages";
import { SampleChallengeSource } from "@/services/generation/sample-source";
import styles from "./GenerateDialog.module.css";
import { STAGE_LABELS, useGenerate } from "./useGenerate";

type Choice<T extends string> = T | "random";

export function GenerateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const source = useChallengeSource();
  const { state, generate, cancel } = useGenerate(source);
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Choice<LanguageId>>("random");
  const [difficulty, setDifficulty] = useState<Choice<Difficulty>>("random");

  const available = source.availableLanguages();
  const status = source.status();
  const samples = source instanceof SampleChallengeSource ? source : undefined;

  const languageOptions: SelectOption<Choice<LanguageId>>[] = useMemo(
    () => [
      { value: "random", label: "Surprise me" },
      ...LANGUAGE_LIST.map((l) => ({
        value: l.id,
        label: available.includes(l.id) ? l.label : `${l.label} — runtime unavailable`,
        disabled: !available.includes(l.id),
      })),
    ],
    [available],
  );

  const difficultyOptions: SelectOption<Choice<Difficulty>>[] = useMemo(
    () => [
      { value: "random", label: "Any difficulty" },
      ...DIFFICULTY_LIST.map((d) => {
        const missing =
          samples &&
          samples.matching({ ...(language !== "random" ? { language } : {}), difficulty: d.id })
            .length === 0;
        return {
          value: d.id,
          label: missing ? `${d.label} — no sample` : d.label,
          disabled: Boolean(missing),
        };
      }),
    ],
    [samples, language],
  );

  const busy = state.phase === "generating";
  const close = () => {
    if (busy) cancel();
    onClose();
  };

  const submit = async () => {
    const attempt = await generate({
      ...(language !== "random" ? { language } : {}),
      ...(difficulty !== "random" ? { difficulty } : {}),
    });
    if (attempt) {
      onClose();
      void navigate(`/workspace/${encodeURIComponent(attempt.id)}`);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="New challenge"
      width={520}
      footer={
        <>
          <Button onClick={close}>{busy ? "Cancel" : "Close"}</Button>
          <Button
            variant="primary"
            busy={busy}
            disabled={status.state !== "ready"}
            onClick={() => void submit()}
          >
            {busy ? "Generating…" : "Generate challenge"}
          </Button>
        </>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className={styles.source}>
          Source: <strong>{status.label}</strong>
        </p>
        {status.state === "needs-configuration" && (
          <Notice tone="warning" title="Generation is not configured">
            {status.reason}
          </Notice>
        )}
        {samples && (
          <Notice tone="info" title="Offline sample mode">
            Sample challenges are a small fixed set for trying the app. Add an API key in Settings
            to generate unlimited new challenges.
          </Notice>
        )}
        <div className={styles.grid}>
          <SelectField
            label="Language"
            value={language}
            options={languageOptions}
            onChange={setLanguage}
            disabled={busy}
          />
          <SelectField
            label="Difficulty"
            value={difficulty}
            options={difficultyOptions}
            onChange={setDifficulty}
            disabled={busy}
          />
        </div>
        <div aria-live="polite" className={styles.status}>
          {state.phase === "generating" && (
            <p className={styles.progress}>
              <Spinner size={14} />
              {state.stage ? STAGE_LABELS[state.stage.stage] : "Starting…"}
              {state.stage && state.stage.attempt > 1 && (
                <span className={styles.attempt}>attempt {state.stage.attempt}</span>
              )}
            </p>
          )}
          {state.phase === "error" && (
            <Notice
              tone="danger"
              title="Couldn't generate a challenge"
              {...(state.details ? { details: state.details } : {})}
            >
              {state.message}
            </Notice>
          )}
        </div>
      </form>
    </Dialog>
  );
}
