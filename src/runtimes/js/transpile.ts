import { transform, type Transform } from "sucrase";
import type { Diagnostic } from "@/domain/execution";

export class TranspileError extends Error {
  constructor(
    message: string,
    readonly diagnostic: Diagnostic,
  ) {
    super(message);
    this.name = "TranspileError";
  }
}

export interface TranspileOptions {
  fileName: string;
  jsx?: boolean;
}

/**
 * Strips types (and JSX) and converts ESM to CommonJS so the result can be
 * evaluated with an injected `require`. Types are erased, not checked.
 */
export function transpile(source: string, options: TranspileOptions): string {
  const transforms: Transform[] = ["typescript", "imports"];
  if (options.jsx) transforms.push("jsx");
  try {
    return transform(source, {
      transforms,
      filePath: options.fileName,
      jsxRuntime: "automatic",
      production: true,
      disableESTransforms: true,
    }).code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const position = /\((\d+):(\d+)\)/.exec(message);
    const diagnostic: Diagnostic = {
      severity: "error",
      message: message.replace(/\s*\(\d+:\d+\)\s*$/, ""),
      ...(position ? { line: Number(position[1]), column: Number(position[2]) + 1 } : {}),
    };
    throw new TranspileError(message, diagnostic);
  }
}
