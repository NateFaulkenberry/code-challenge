import { useId, useMemo } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";
import type { LayoutOutletContext } from "@/app/Layout";
import { useLibrary } from "@/app/context";
import { Button } from "@/components/Button";
import { Field, fieldStyles, SelectField } from "@/components/Field";
import { ATTEMPT_STATUS_LABELS, ATTEMPT_STATUSES } from "@/domain/attempt";
import { DIFFICULTY_LIST } from "@/domain/difficulty";
import { LANGUAGE_LIST, LANGUAGES } from "@/domain/languages";
import {
  activityDate,
  queryFromParams,
  queryLibrary,
  queryToParams,
  type LibraryQuery,
  type SortKey,
} from "@/domain/library";
import { CATEGORIES, CATEGORY_LABELS } from "@/domain/taxonomy";
import { DifficultyBadge, StatusBadge } from "@/features/challenge/ChallengeMeta";
import { formatShortDate, pluralize } from "@/utils/format";
import styles from "./LibraryPage.module.css";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "difficulty", label: "Difficulty" },
  { value: "language", label: "Language" },
  { value: "title", label: "Title" },
];

export function LibraryPage() {
  const { openGenerate } = useOutletContext<LayoutOutletContext>();
  const { entries, loading } = useLibrary();
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => queryFromParams(params), [params]);
  const searchId = useId();
  const fromId = useId();

  const origins = useMemo(() => new Map(entries.map((e) => [e.attempt.id, e.origin])), [entries]);
  const attempts = useMemo(() => entries.map((e) => e.attempt), [entries]);
  const results = useMemo(() => queryLibrary(attempts, query), [attempts, query]);
  const completed = attempts.filter((a) => a.status === "passed").length;
  const filtered = queryToParams(query).toString() !== "";

  const update = (patch: Partial<LibraryQuery>) =>
    setParams(queryToParams({ ...query, ...patch }), { replace: true });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>My Challenges</h1>
          <p className={styles.subtitle}>
            {pluralize(completed, "completed challenge")}
            {attempts.length > completed && ` · ${attempts.length - completed} in progress`}
          </p>
        </div>
      </header>

      <search className={styles.filters} aria-label="Filter challenges">
        <div className={styles.search}>
          <Field label="Search" htmlFor={searchId}>
            <input
              id={searchId}
              type="search"
              className={fieldStyles.control}
              placeholder="Title, concept or language…"
              value={query.search}
              onChange={(e) => update({ search: e.target.value })}
            />
          </Field>
        </div>
        <SelectField
          label="Language"
          value={query.language}
          onChange={(language) => update({ language })}
          options={[
            { value: "all", label: "All languages" },
            ...LANGUAGE_LIST.map((l) => ({ value: l.id, label: l.label })),
          ]}
        />
        <SelectField
          label="Difficulty"
          value={query.difficulty}
          onChange={(difficulty) => update({ difficulty })}
          options={[
            { value: "all", label: "All" },
            ...DIFFICULTY_LIST.map((d) => ({ value: d.id, label: d.label })),
          ]}
        />
        <SelectField
          label="Category"
          value={query.category}
          onChange={(category) => update({ category })}
          options={[
            { value: "all", label: "All" },
            ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
          ]}
        />
        <SelectField
          label="Status"
          value={query.status}
          onChange={(status) => update({ status })}
          options={[
            { value: "all", label: "All" },
            ...ATTEMPT_STATUSES.map((s) => ({ value: s, label: ATTEMPT_STATUS_LABELS[s] })),
          ]}
        />
        <Field label="Since" htmlFor={fromId}>
          <input
            id={fromId}
            type="date"
            className={fieldStyles.control}
            value={query.from ?? ""}
            onChange={(e) => {
              const next: LibraryQuery = { ...query };
              if (e.target.value) next.from = e.target.value;
              else delete next.from;
              setParams(queryToParams(next), { replace: true });
            }}
          />
        </Field>
        <SelectField
          label="Sort by"
          value={query.sort}
          onChange={(sort) => update({ sort })}
          options={SORT_OPTIONS}
        />
      </search>

      <p className="visually-hidden" aria-live="polite">
        {pluralize(results.length, "challenge")} shown
      </p>

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : attempts.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No challenges yet</h2>
          <p>Generate a challenge, solve it, and it will appear here.</p>
          <Button variant="primary" onClick={openGenerate}>
            Generate a challenge
          </Button>
        </div>
      ) : results.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No challenges match these filters.</p>
          {filtered && (
            <Button onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Language</th>
                <th scope="col">Difficulty</th>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col" className={styles.dateCol}>
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((attempt) => {
                const origin = origins.get(attempt.id);
                const href =
                  origin === "local" && attempt.status !== "passed"
                    ? `/workspace/${encodeURIComponent(attempt.id)}`
                    : `/challenges/${encodeURIComponent(attempt.id)}`;
                return (
                  <tr key={attempt.id}>
                    <td className={styles.language}>
                      {LANGUAGES[attempt.challenge.language].label}
                    </td>
                    <td>
                      <DifficultyBadge difficulty={attempt.challenge.difficulty} />
                    </td>
                    <td className={styles.titleCell}>
                      <Link to={href} className={styles.title}>
                        {attempt.challenge.title}
                      </Link>
                      <span className={styles.summary}>{attempt.challenge.summary}</span>
                    </td>
                    <td>
                      <StatusBadge status={attempt.status} />
                      {origin === "published" && (
                        <span className={styles.published}>published</span>
                      )}
                    </td>
                    <td className={styles.dateCol}>
                      <time dateTime={activityDate(attempt)}>
                        {formatShortDate(activityDate(attempt))}
                      </time>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
