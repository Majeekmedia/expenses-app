/**
 * Resolves the app's `@/` TypeScript path alias for Node.
 *
 * The verification scripts must run the **real** `src/` modules — a copy would
 * drift and prove nothing. But those modules import through `@/*`, which only
 * Metro and TypeScript understand. This hook teaches Node the same mapping, so
 * `scripts/verify-db.mts` and `scripts/verify-logic.mts` can import
 * `src/db/repository.ts` directly with no build step and no duplicates.
 *
 * Registered via `--import ./scripts/register-alias.mjs`.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(projectRoot, 'src');

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs', '/index.ts', '/index.tsx'];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = join(srcRoot, specifier.slice(2));
    for (const extension of EXTENSIONS) {
      const candidate = base + extension;
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    // Fall through to the default resolver so the error names the real problem.
  }

  return nextResolve(specifier, context);
}
