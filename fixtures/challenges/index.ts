import type { Challenge } from "@/domain/challenge";
import cAdvanced from "./c-advanced";
import cppExpert from "./cpp-expert";
import phpIntermediate from "./php-intermediate";
import pythonAdvanced from "./python-advanced";
import reactIntermediate from "./react-intermediate";
import typescriptAdvanced from "./typescript-advanced";
import typescriptBeginner from "./typescript-beginner";

export const FIXTURES = {
  "typescript-beginner": typescriptBeginner,
  "typescript-advanced": typescriptAdvanced,
  "react-intermediate": reactIntermediate,
  "python-advanced": pythonAdvanced,
  "php-intermediate": phpIntermediate,
  "c-advanced": cAdvanced,
  "cpp-expert": cppExpert,
} satisfies Record<string, Challenge>;

export type FixtureKey = keyof typeof FIXTURES;

export const FIXTURE_LIST: readonly Challenge[] = Object.values(FIXTURES);
