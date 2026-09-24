import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Markdown } from "@/components/Markdown";
import type { Challenge } from "@/domain/challenge";
import { CodeEditor } from "@/editor/CodeEditor";
import styles from "./ReferenceSolution.module.css";

export interface ReferenceSolutionProps {
  challenge: Challenge;
  revealed: boolean;
  onReveal: () => void;
  /** The user's solution, enabling the optional side-by-side comparison. */
  mySolution?: string;
  fontSize?: number;
}

export function ReferenceSolution({
  challenge,
  revealed,
  onReveal,
  mySolution,
  fontSize,
}: ReferenceSolutionProps) {
  const [confirming, setConfirming] = useState(false);
  const [compare, setCompare] = useState(false);

  if (!revealed) {
    return (
      <div className={styles.locked}>
        <p>The reference solution and its explanation are hidden.</p>
        <Button onClick={() => setConfirming(true)}>Reveal solution</Button>
        <ConfirmDialog
          open={confirming}
          title="Reveal the reference solution?"
          confirmLabel="Reveal solution"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onReveal();
          }}
        >
          Viewing the reference solution will reveal the intended implementation.
        </ConfirmDialog>
      </div>
    );
  }

  return (
    <div className={styles.revealed}>
      <div className={styles.labelRow}>
        <Badge
          tone="warning"
          title="Produced by the challenge generator and verified against the tests — not necessarily the best solution."
        >
          Generated reference implementation
        </Badge>
        {challenge.complexity && (
          <span className={styles.complexity}>
            Time <code>{challenge.complexity.time}</code> · Space{" "}
            <code>{challenge.complexity.space}</code>
            <span className={styles.stated}> (as stated by the generator)</span>
          </span>
        )}
        {mySolution !== undefined && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCompare((c) => !c)}
            aria-pressed={compare}
          >
            {compare ? "Hide comparison" : "Compare with my solution"}
          </Button>
        )}
      </div>
      {compare && mySolution !== undefined ? (
        <div className={styles.compare}>
          <figure>
            <figcaption>My solution</figcaption>
            <CodeEditor
              value={mySolution}
              language={challenge.language}
              readOnly
              label="My solution"
              fontSize={fontSize}
            />
          </figure>
          <figure>
            <figcaption>Reference solution</figcaption>
            <CodeEditor
              value={challenge.referenceSolution}
              language={challenge.language}
              readOnly
              label="Reference solution"
              fontSize={fontSize}
            />
          </figure>
        </div>
      ) : (
        <div className={styles.code}>
          <CodeEditor
            value={challenge.referenceSolution}
            language={challenge.language}
            readOnly
            label="Reference solution"
            fontSize={fontSize}
          />
        </div>
      )}
      <section aria-label="Explanation">
        <h3 className={styles.heading}>Explanation</h3>
        <Markdown source={challenge.explanation} />
      </section>
      <section aria-label="Concepts">
        <h3 className={styles.heading}>Concepts</h3>
        <ul className={styles.concepts}>
          {challenge.expectedConcepts.map((concept) => (
            <li key={concept}>{concept}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
