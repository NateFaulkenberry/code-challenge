import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import { Tabs } from "@/components/Tabs";
import type { Attempt } from "@/domain/attempt";
import { hiddenTestCount, visibleTests } from "@/domain/challenge";
import { LANGUAGES } from "@/domain/languages";
import { ARCHETYPE_LABELS } from "@/domain/taxonomy";
import { ReferenceSolution } from "@/features/challenge/ReferenceSolution";
import styles from "./ChallengePanel.module.css";

type PanelTab = "challenge" | "reference";

export function ChallengePanel({
  attempt,
  source,
  fontSize,
  onReveal,
}: {
  attempt: Attempt;
  source: string;
  fontSize: number;
  onReveal: () => void;
}) {
  const [tab, setTab] = useState<PanelTab>("challenge");
  const { challenge } = attempt;
  const language = LANGUAGES[challenge.language];

  return (
    <Tabs
      label="Challenge information"
      active={tab}
      onChange={setTab}
      tabs={[
        { id: "challenge", label: "Challenge" },
        { id: "reference", label: "Reference solution" },
      ]}
    >
      {tab === "challenge" ? (
        <div className={styles.content}>
          <p className={styles.summary}>{challenge.summary}</p>
          {challenge.realWorldContext && (
            <p className={styles.context}>{challenge.realWorldContext}</p>
          )}
          <section aria-labelledby="statement-heading">
            <h2 id="statement-heading" className={styles.heading}>
              Problem
            </h2>
            <Markdown source={challenge.problemStatement} />
          </section>
          <section aria-labelledby="requirements-heading">
            <h2 id="requirements-heading" className={styles.heading}>
              Requirements
            </h2>
            <ul className={styles.list}>
              {challenge.requirements.map((requirement) => (
                <li key={requirement}>
                  <Markdown source={requirement} />
                </li>
              ))}
            </ul>
          </section>
          {challenge.constraints.length > 0 && (
            <section aria-labelledby="constraints-heading">
              <h2 id="constraints-heading" className={styles.heading}>
                Constraints
              </h2>
              <ul className={styles.list}>
                {challenge.constraints.map((constraint) => (
                  <li key={constraint}>
                    <Markdown source={constraint} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="environment-heading" className={styles.environment}>
            <h2 id="environment-heading" className={styles.heading}>
              Environment
            </h2>
            <p>{language.runtimeSummary}</p>
            <ul className={styles.list}>
              {language.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className={styles.facts}>
              {visibleTests(challenge).length} visible tests · {hiddenTestCount(challenge)} hidden
              tests · {ARCHETYPE_LABELS[challenge.archetype]} · ~{challenge.estimatedTimeMinutes}{" "}
              min
            </p>
          </section>
        </div>
      ) : (
        <div className={styles.content}>
          <ReferenceSolution
            challenge={challenge}
            revealed={attempt.referenceRevealed}
            onReveal={onReveal}
            mySolution={source}
            fontSize={fontSize}
          />
        </div>
      )}
    </Tabs>
  );
}
