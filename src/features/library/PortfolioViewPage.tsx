import { useId, useState } from "react";
import { Link, useParams } from "react-router";
import { useLibrary, useServices, useSettings } from "@/app/context";
import { Button } from "@/components/Button";
import { fieldStyles } from "@/components/Field";
import { Markdown } from "@/components/Markdown";
import { Notice } from "@/components/Notice";
import { revealReference } from "@/domain/attempt";
import { summarizeTestRun } from "@/domain/execution";
import { CodeEditor } from "@/editor/CodeEditor";
import { ChallengeMeta, StatusBadge } from "@/features/challenge/ChallengeMeta";
import { ReferenceSolution } from "@/features/challenge/ReferenceSolution";
import { TestResultList } from "@/features/challenge/TestResultList";
import { formatDate, formatDuration } from "@/utils/format";
import styles from "./PortfolioViewPage.module.css";

/**
 * Read-only presentation of a challenge for visitors:
 * Problem → Approach → Solution → Tests → Result, with the reference behind a confirmation.
 */
export function PortfolioViewPage() {
  const { id = "" } = useParams();
  const { entries, loading } = useLibrary();
  const { attempts } = useServices();
  const { settings } = useSettings();
  const entry = entries.find((e) => e.attempt.id === id);
  const [visitorRevealed, setVisitorRevealed] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const notesId = useId();

  if (loading) return <div className={styles.page}>Loading…</div>;
  if (!entry) {
    return (
      <div className={styles.page}>
        <Notice tone="warning" title="Challenge not found">
          It may have been removed from this browser.{" "}
          <Link to="/challenges">Back to My Challenges</Link>
        </Notice>
      </div>
    );
  }

  const { attempt, origin } = entry;
  const { challenge } = attempt;
  const isLocal = origin === "local";
  const solution = attempt.passedSolution ?? attempt.solution;
  const run = attempt.lastTestRun;
  const summary = run ? summarizeTestRun(run) : undefined;
  const revealed = isLocal ? attempt.referenceRevealed : visitorRevealed;

  const saveNotes = async () => {
    await attempts.save({ ...attempt, approachNotes: notes, updatedAt: new Date().toISOString() });
    setEditingNotes(false);
  };

  return (
    <article className={styles.page} aria-labelledby="challenge-title">
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/challenges">My Challenges</Link> <span aria-hidden="true">/</span>{" "}
        <span>{challenge.title}</span>
      </nav>

      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h1 id="challenge-title">{challenge.title}</h1>
          <ChallengeMeta challenge={challenge} extra={<StatusBadge status={attempt.status} />} />
          <p className={styles.summary}>{challenge.summary}</p>
        </div>
        {isLocal && (
          <Link to={`/workspace/${encodeURIComponent(attempt.id)}`} className={styles.openLink}>
            Open in workspace →
          </Link>
        )}
      </header>

      <section className={styles.section} aria-labelledby="problem-title">
        <h2 id="problem-title">Problem</h2>
        {challenge.realWorldContext && (
          <p className={styles.context}>{challenge.realWorldContext}</p>
        )}
        <Markdown source={challenge.problemStatement} />
        <h3>Requirements</h3>
        <ul className={styles.list}>
          {challenge.requirements.map((r) => (
            <li key={r}>
              <Markdown source={r} />
            </li>
          ))}
        </ul>
        {challenge.constraints.length > 0 && (
          <>
            <h3>Constraints</h3>
            <ul className={styles.list}>
              {challenge.constraints.map((c) => (
                <li key={c}>
                  <Markdown source={c} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={styles.section} aria-labelledby="approach-title">
        <div className={styles.sectionHeader}>
          <h2 id="approach-title">Approach</h2>
          {isLocal && !editingNotes && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNotes(attempt.approachNotes);
                setEditingNotes(true);
              }}
            >
              {attempt.approachNotes ? "Edit" : "Add notes"}
            </Button>
          )}
        </div>
        {editingNotes ? (
          <div className={styles.notesEditor}>
            <label htmlFor={notesId} className="visually-hidden">
              Approach notes (Markdown)
            </label>
            <textarea
              id={notesId}
              className={fieldStyles.control}
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did you approach the problem? What trade-offs did you make?"
            />
            <div className={styles.notesActions}>
              <Button onClick={() => setEditingNotes(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => void saveNotes()}>
                Save notes
              </Button>
            </div>
          </div>
        ) : attempt.approachNotes ? (
          <Markdown source={attempt.approachNotes} />
        ) : (
          <p className={styles.muted}>No approach notes were written for this challenge.</p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="solution-title">
        <h2 id="solution-title">
          {attempt.status === "passed" ? "My solution" : "Current solution (not yet passing)"}
        </h2>
        <div className={styles.code}>
          <CodeEditor
            value={solution}
            language={challenge.language}
            readOnly
            label="Solution source code"
            fontSize={settings.editorFontSize}
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="tests-title">
        <h2 id="tests-title">Tests</h2>
        <TestResultList
          cases={challenge.tests.cases}
          {...(run ? { results: run.results } : {})}
          revealHiddenNames={attempt.status === "passed"}
          showCode
        />
      </section>

      <section className={styles.section} aria-labelledby="result-title">
        <h2 id="result-title">Result</h2>
        <dl className={styles.result}>
          <div>
            <dt>Status</dt>
            <dd>{attempt.status === "passed" ? "All tests passing" : "Not yet passing"}</dd>
          </div>
          {summary && (
            <div>
              <dt>Last run</dt>
              <dd>
                {summary.passed}/{summary.total} tests passed
                {run && ` in ${formatDuration(run.execution.durationMs)}`}
              </dd>
            </div>
          )}
          <div>
            <dt>Test runs</dt>
            <dd>{attempt.testRunCount}</dd>
          </div>
          {attempt.completedAt && (
            <div>
              <dt>Completed</dt>
              <dd>
                <time dateTime={attempt.completedAt}>{formatDate(attempt.completedAt)}</time>
              </dd>
            </div>
          )}
          <div>
            <dt>Challenge source</dt>
            <dd>
              {challenge.provenance.source === "llm"
                ? `Generated (${challenge.provenance.model ?? "LLM"}, ${challenge.provenance.generatorVersion})`
                : challenge.provenance.source === "fixture"
                  ? "Sample challenge"
                  : "Imported"}
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="reference-title">
        <h2 id="reference-title">Reference solution</h2>
        <ReferenceSolution
          challenge={challenge}
          revealed={revealed}
          mySolution={solution}
          fontSize={settings.editorFontSize}
          onReveal={() => {
            if (isLocal) void attempts.save(revealReference(attempt, new Date()));
            else setVisitorRevealed(true);
          }}
        />
      </section>
    </article>
  );
}
