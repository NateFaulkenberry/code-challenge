import {
  CHALLENGE_SCHEMA_VERSION,
  ChallengeSchema,
  type Challenge,
  type ChallengeDraft,
} from "@/domain/challenge";
import { fingerprintChallenge } from "@/domain/fingerprint";
import { slugify } from "@/utils/slug";

/**
 * Deterministic fixtures for tests, development and offline demos.
 * They are NOT the production challenge source — generation is.
 */
export function defineFixture(draft: ChallengeDraft): Challenge {
  return ChallengeSchema.parse({
    ...draft,
    schemaVersion: CHALLENGE_SCHEMA_VERSION,
    id: `fixture-${draft.language}-${draft.difficulty}-${slugify(draft.title)}`,
    slug: slugify(draft.title),
    fingerprint: fingerprintChallenge(draft),
    provenance: {
      source: "fixture",
      generatorVersion: "fixture-v1",
      generatedAt: "2026-09-01T00:00:00.000Z",
    },
  });
}
