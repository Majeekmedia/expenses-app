/**
 * Registers {@link ./alias-loader.mjs} so `@/` imports resolve under Node.
 *
 * Usage: `node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/verify-db.mts`
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./alias-loader.mjs', pathToFileURL(import.meta.filename));
