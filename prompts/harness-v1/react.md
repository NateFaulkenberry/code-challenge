- The solution file is `solution.tsx`. It must `export default` the main component, and may export additional named components/hooks.
- The default export is also rendered **with no props** in a live preview, so every prop must be optional with a sensible default (e.g. a built-in in-memory data source with a short artificial delay). Tests pass explicit props.
- Only `react` may be imported by the solution (hooks via `import { useState } from "react";`). JSX uses the automatic runtime — do not import React just for JSX.
- `tests.prelude` runs before each test. Import the component with `import Component from "./solution";` and use Testing Library:
  `import { render, screen, waitFor, act, within } from "@testing-library/react";` and `import userEvent from "@testing-library/user-event";`.
- Each test `code` is the **body of an async function**. Prefer `const user = userEvent.setup();` and `await user.type(...)`, `await user.click(...)`, `await user.keyboard(...)`. Query by role/label/text (`screen.getByRole("button", { name: /save/i })`).
- Assertions use a Jest-compatible `expect` with DOM matchers: `toBeInTheDocument`, `toHaveTextContent`, `toHaveValue`, `toBeDisabled`, `toBeVisible`, `toHaveAttribute`, plus all standard matchers, `.not`, `.resolves`, `.rejects`. `fn()` creates a spy; `sleep(ms)` waits.
- The DOM is reset between tests. Each test has a 2 second limit. There is no network: simulate async data with props such as `fetchResults: (query: string) => Promise<T[]>` that tests supply.
- Build accessible UI: labelled inputs, buttons with names, `role="status"`/`role="alert"` for async states — tests should query by those roles.

Example test case:

```json
{
  "id": "shows-empty-state",
  "name": "shows an empty state when there are no results",
  "hidden": false,
  "code": "const user = userEvent.setup();\nrender(<SearchList fetchResults={async () => []} />);\nawait user.type(screen.getByRole(\"searchbox\"), \"zz\");\nexpect(await screen.findByText(/no results/i)).toBeInTheDocument();"
}
```
