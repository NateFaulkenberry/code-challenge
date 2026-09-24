// The per-version php-wasm builds ship without type declarations.
declare module "@php-wasm/web-8-4" {
  import type { PHPLoaderModule } from "@php-wasm/universal";
  export function getPHPLoaderModule(): Promise<PHPLoaderModule>;
}

declare module "@php-wasm/node-8-4" {
  import type { PHPLoaderModule } from "@php-wasm/universal";
  export function getPHPLoaderModule(): Promise<PHPLoaderModule>;
}
