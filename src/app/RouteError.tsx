import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { Notice } from "@/components/Notice";
import styles from "./RouteError.module.css";

export function RouteErrorPage() {
  const error = useRouteError();
  const details = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? (error.stack ?? error.message)
      : String(error);
  return (
    <div className={styles.page}>
      <Notice tone="danger" title="Something went wrong" details={details}>
        This page failed to load. Your saved work is not affected.{" "}
        <Link to="/">Return to the dashboard</Link>.
      </Notice>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <h1>Page not found</h1>
      <p>
        There&apos;s nothing at this address. <Link to="/">Go to the dashboard</Link>.
      </p>
    </div>
  );
}
