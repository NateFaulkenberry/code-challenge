import { useMemo } from "react";
import { Link, useOutletContext } from "react-router";
import type { LayoutOutletContext } from "@/app/Layout";
import { useLibrary } from "@/app/context";
import { Button } from "@/components/Button";
import { DIFFICULTY_LIST } from "@/domain/difficulty";
import { LANGUAGE_LIST, LANGUAGES } from "@/domain/languages";
import { activityDate } from "@/domain/library";
import { computeStats } from "@/domain/stats";
import { ChallengeMeta, StatusBadge } from "@/features/challenge/ChallengeMeta";
import { implementedLanguages } from "@/runtimes/registry";
import { formatDate, formatShortDate } from "@/utils/format";
import styles from "./DashboardPage.module.css";

export function DashboardPage() {
  const { openGenerate } = useOutletContext<LayoutOutletContext>();
  const { entries, loading } = useLibrary();
  const attempts = useMemo(() => entries.map((e) => e.attempt), [entries]);
  const stats = useMemo(() => computeStats(attempts), [attempts]);
  const recent = useMemo(
    () =>
      [...entries]
        .sort((a, b) => activityDate(b.attempt).localeCompare(activityDate(a.attempt)))
        .slice(0, 6),
    [entries],
  );
  const inProgress = entries.filter((e) => e.origin === "local" && e.attempt.status !== "passed");
  const runnable = new Set(implementedLanguages());
  const maxLanguage = Math.max(1, ...stats.byLanguage.map((l) => l.completed));

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div>
          <p className={styles.eyebrow}>Coding Challenge Lab</p>
          <h1 id="hero-title" className={styles.title}>
            Sharpening engineering skills through real-world, continuously generated challenges.
          </h1>
          <p className={styles.lede}>
            Every challenge is generated fresh, validated by running its reference solution, and
            solved and tested entirely in the browser. Runnable today:{" "}
            {LANGUAGE_LIST.filter((l) => runnable.has(l.id))
              .map((l) => l.label)
              .join(", ")}
            .
          </p>
          <div className={styles.heroActions}>
            <Button variant="primary" onClick={openGenerate}>
              Generate a challenge
            </Button>
            <Link to="/challenges" className={styles.secondaryLink}>
              Browse completed work →
            </Link>
          </div>
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="progress-title">
          <h2 id="progress-title" className={styles.cardTitle}>
            Progress
          </h2>
          {loading ? (
            <p className={styles.muted}>Loading…</p>
          ) : (
            <>
              <dl className={styles.kpis}>
                <div>
                  <dt>Completed</dt>
                  <dd>{stats.completed}</dd>
                </div>
                <div>
                  <dt>Attempted</dt>
                  <dd>{stats.attempted}</dd>
                </div>
                <div>
                  <dt>Avg. test runs to pass</dt>
                  <dd>
                    {stats.averageRunsToPass === null ? "—" : stats.averageRunsToPass.toFixed(1)}
                  </dd>
                </div>
              </dl>
              {stats.completed === 0 ? (
                <p className={styles.muted}>
                  No completed challenges yet. Solve one to start the record.
                </p>
              ) : (
                <>
                  <h3 className={styles.subTitle}>By language</h3>
                  <ul className={styles.bars}>
                    {stats.byLanguage.map(({ language, completed }) => (
                      <li key={language}>
                        <span className={styles.barLabel}>{LANGUAGES[language].label}</span>
                        <span className={styles.barTrack} aria-hidden="true">
                          <span
                            className={styles.barFill}
                            style={{ width: `${(completed / maxLanguage) * 100}%` }}
                          />
                        </span>
                        <span className={styles.barValue}>{completed}</span>
                      </li>
                    ))}
                  </ul>
                  <h3 className={styles.subTitle}>By difficulty</h3>
                  <ul className={styles.chips}>
                    {DIFFICULTY_LIST.map((d) => (
                      <li key={d.id}>
                        {d.label} <strong>{stats.byDifficulty[d.id]}</strong>
                      </li>
                    ))}
                  </ul>
                  {stats.lastCompletedAt && (
                    <p className={styles.muted}>
                      Last completed {formatDate(stats.lastCompletedAt)}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </section>

        <section className={styles.card} aria-labelledby="recent-title">
          <div className={styles.cardHeader}>
            <h2 id="recent-title" className={styles.cardTitle}>
              Recent work
            </h2>
            {entries.length > 0 && <Link to="/challenges">View all</Link>}
          </div>
          {recent.length === 0 ? (
            <p className={styles.muted}>Nothing here yet.</p>
          ) : (
            <ul className={styles.recent}>
              {recent.map(({ attempt, origin }) => (
                <li key={attempt.id}>
                  <Link
                    to={
                      origin === "local" && attempt.status !== "passed"
                        ? `/workspace/${encodeURIComponent(attempt.id)}`
                        : `/challenges/${encodeURIComponent(attempt.id)}`
                    }
                    className={styles.recentLink}
                  >
                    <span className={styles.recentTitle}>{attempt.challenge.title}</span>
                    <ChallengeMeta challenge={attempt.challenge} />
                  </Link>
                  <div className={styles.recentSide}>
                    <StatusBadge status={attempt.status} />
                    <span className={styles.muted}>{formatShortDate(activityDate(attempt))}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {inProgress.length > 0 && (
            <p className={styles.muted}>
              {inProgress.length} challenge{inProgress.length === 1 ? "" : "s"} in progress.
            </p>
          )}
        </section>
      </div>

      <section className={styles.card} aria-labelledby="runtimes-title">
        <h2 id="runtimes-title" className={styles.cardTitle}>
          Languages
        </h2>
        <ul className={styles.languages}>
          {LANGUAGE_LIST.map((language) => (
            <li
              key={language.id}
              className={runnable.has(language.id) ? undefined : styles.unavailable}
            >
              <span className={styles.languageName}>{language.label}</span>
              <span className={styles.muted}>{language.runtimeSummary}</span>
              <span className={styles.languageStatus}>
                {runnable.has(language.id)
                  ? language.maturity === "stable"
                    ? "Available"
                    : "Experimental"
                  : "Not yet available"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
