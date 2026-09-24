import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "public/runtimes", "playwright-report", "test-results"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Tests assert on shapes they just constructed; `!` keeps them readable.
    files: ["**/*.test.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  {
    // Command-line scripts report to the terminal by design.
    files: ["scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
  },
);
