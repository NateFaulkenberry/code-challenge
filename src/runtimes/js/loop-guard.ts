import { parse, type Node } from "acorn";
import { ancestor } from "acorn-walk";

export const LOOP_START = "__ccl_loopStart";
export const LOOP_CHECK = "__ccl_loopCheck";

export class LoopBudgetError extends Error {
  constructor(budgetMs: number) {
    super(
      `A loop ran for more than ${budgetMs / 1000}s and was stopped. Is there an infinite loop?`,
    );
    this.name = "LoopBudgetError";
  }
}

type LoopNode = Node & { body: Node & { type: string } };
const LOOP_TYPES = new Set([
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
]);

interface Edit {
  at: number;
  text: string;
  /** Tie-breaker for edits at the same offset: lower goes first. */
  order: number;
}

/**
 * Rewrites every loop so it records its start time and checks a time budget
 * on each iteration:
 *
 *   { let __l1 = __ccl_loopStart(); while (c) { __ccl_loopCheck(__l1); … } }
 *
 * The wrapping block keeps the rewrite valid in any statement position
 * (`if (x) while (…)`); labelled loops are wrapped outside their label so
 * `continue label` still works. This matters most where termination isn't
 * possible (an iframe sharing the page's thread); in workers it turns a
 * runaway loop into an ordinary, attributable error.
 */
export function instrumentLoops(code: string): string {
  const ast = parse(code, {
    ecmaVersion: "latest",
    sourceType: "script",
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true,
    allowHashBang: true,
  });
  const edits: Edit[] = [];
  let counter = 0;

  ancestor(ast, {
    Statement(node: Node, _state: unknown, ancestors: Node[]) {
      if (!LOOP_TYPES.has(node.type)) return;
      const loop = node as LoopNode;
      const id = `__ccl_l${++counter}`;
      let outer: Node = loop;
      // Include any chain of labels in the wrapped region.
      for (let i = ancestors.length - 2; i >= 0 && ancestors[i]?.type === "LabeledStatement"; i--)
        outer = ancestors[i] as Node;
      edits.push({ at: outer.start, text: `{ let ${id} = ${LOOP_START}(); `, order: 0 });
      edits.push({ at: outer.end, text: " }", order: 2 });
      const check = `${LOOP_CHECK}(${id});`;
      if (loop.body.type === "BlockStatement") {
        edits.push({ at: loop.body.start + 1, text: ` ${check}`, order: 1 });
      } else {
        edits.push({ at: loop.body.start, text: `{ ${check} `, order: 1 });
        edits.push({ at: loop.body.end, text: " }", order: 1 });
      }
    },
  });

  // Apply from the end so earlier offsets stay valid. For equal offsets,
  // closing braces (order 2) of an inner loop must precede outer ones, which
  // reverse application of stable insertion order provides.
  edits.sort((a, b) => b.at - a.at || b.order - a.order);
  let output = code;
  for (const edit of edits) output = output.slice(0, edit.at) + edit.text + output.slice(edit.at);
  return output;
}

export interface LoopGuard {
  bindings: { [LOOP_START]: () => number; [LOOP_CHECK]: (start: number) => void };
}

export function createLoopGuard(
  budgetMs: number,
  now: () => number = () => performance.now(),
): LoopGuard {
  let iterations = 0;
  return {
    bindings: {
      [LOOP_START]: now,
      [LOOP_CHECK]: (start: number) => {
        if ((++iterations & 1023) === 0 && now() - start > budgetMs)
          throw new LoopBudgetError(budgetMs);
      },
    },
  };
}
