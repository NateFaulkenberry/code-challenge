/**
 * Copies self-hosted language toolchains from node_modules into
 * public/runtimes/<language>/<version>/ so they're served as static files
 * (ADR-010). Versioned paths make the files safely cacheable forever.
 * Runs automatically before `dev` and `build`.
 */
import { cp, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgVersion = async (name) =>
  JSON.parse(await readFile(join(root, "node_modules", name, "package.json"), "utf8")).version;

const runtimes = [
  {
    language: "python",
    pkg: "pyodide",
    files: ["pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"],
  },
  {
    // Loaded unbundled: bundle.js resolves its wasm/tar siblings via import.meta.url.
    language: "clang",
    pkg: "@yowasp/clang",
    files: [
      "gen/bundle.js",
      "gen/llvm-resources.tar",
      "gen/llvm.core.wasm",
      "gen/llvm.core2.wasm",
      "gen/llvm.core3.wasm",
      "gen/llvm.core4.wasm",
    ],
  },
];

for (const runtime of runtimes) {
  const version = await pkgVersion(runtime.pkg);
  const target = join(root, "public", "runtimes", runtime.language, version);
  await mkdir(target, { recursive: true });
  for (const file of runtime.files) {
    const source = join(root, "node_modules", runtime.pkg, file);
    const destination = join(target, file.split("/").pop());
    const [src, dest] = await Promise.all([stat(source), stat(destination).catch(() => undefined)]);
    if (dest && dest.size === src.size) continue;
    await cp(source, destination);
  }
  console.log(
    `runtime assets: ${runtime.language} ${version} → public/runtimes/${runtime.language}/${version}/`,
  );
}
