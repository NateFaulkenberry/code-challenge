import { Badge, type BadgeTone } from "@/components/Badge";
import { ATTEMPT_STATUS_LABELS, type AttemptStatus } from "@/domain/attempt";
import type { Challenge } from "@/domain/challenge";
import { DIFFICULTY_DEFINITIONS, type Difficulty } from "@/domain/difficulty";
import { LANGUAGES } from "@/domain/languages";
import { CATEGORY_LABELS } from "@/domain/taxonomy";
import styles from "./ChallengeMeta.module.css";

const DIFFICULTY_TONES: Record<Difficulty, BadgeTone> = {
  beginner: "success",
  intermediate: "info",
  advanced: "warning",
  expert: "danger",
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Badge tone={DIFFICULTY_TONES[difficulty]}>{DIFFICULTY_DEFINITIONS[difficulty].label}</Badge>
  );
}

const STATUS_TONES: Record<AttemptStatus, BadgeTone> = {
  generated: "neutral",
  "in-progress": "info",
  passed: "success",
};

export function StatusBadge({ status }: { status: AttemptStatus }) {
  return (
    <Badge tone={STATUS_TONES[status]}>
      {status === "passed" && <span aria-hidden="true">✓</span>}
      {ATTEMPT_STATUS_LABELS[status]}
    </Badge>
  );
}

/** "TypeScript · Advanced · Async Programming" line used across views. */
export function ChallengeMeta({
  challenge,
  extra,
}: {
  challenge: Challenge;
  extra?: React.ReactNode;
}) {
  return (
    <div className={styles.meta}>
      <span className={styles.language}>{LANGUAGES[challenge.language].label}</span>
      <span aria-hidden="true" className={styles.dot}>
        ·
      </span>
      <DifficultyBadge difficulty={challenge.difficulty} />
      <span aria-hidden="true" className={styles.dot}>
        ·
      </span>
      <span>{CATEGORY_LABELS[challenge.category]}</span>
      {extra}
    </div>
  );
}
