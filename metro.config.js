/**
 * Metro config — and the reason this file has to exist at all.
 *
 * `expo-sqlite` on **web** runs a WebAssembly build of SQLite that needs
 * `SharedArrayBuffer`. Browsers only expose `SharedArrayBuffer` on a
 * **cross-origin-isolated** page, which requires the two headers below on every
 * response. Without them the app throws `SharedArrayBuffer is not defined` and a
 * whole class of browser verification — the kind that caught two real layout
 * bugs in App #2 — becomes impossible.
 *
 * Three separate things have to be true, and each fails silently on its own:
 *
 *   1. Metro must treat `.wasm` as an **asset**, or it tries to parse it as JS.
 *   2. The dev server must send `Cross-Origin-Opener-Policy` and
 *      `Cross-Origin-Embedder-Policy`.
 *   3. The page must then report `crossOriginIsolated === true`.
 *
 * (2) sets those headers on Metro's *bundler* responses. Note that Metro also
 * serves the HTML shell, but for a deeper guarantee the app's web output is
 * static — so `scripts/verify-web-headers.mjs` checks the served headers rather
 * than trusting this file's intent.
 */
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// (1) Let Metro treat the SQLite WASM binary as an asset instead of source.
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

// `expo-sqlite` on web is an ES module that imports the worker + wasm. Keeping
// `.mjs` in the source extensions lets Metro resolve it without a custom babel pass.
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

/**
 * (2) Cross-origin isolation headers, dev-server only.
 *
 * `credentialless` rather than `require-corp` for COEP: it still yields
 * `SharedArrayBuffer`, but does not force every third-party subresource to opt in
 * with CORP headers, which would break the Metro HMR websocket and any remote
 * asset during development.
 *
 * These are development-only. A production deploy needs the same two headers at
 * the host; that is documented in the README rather than pretended to be handled
 * here, because Metro does not control the host.
 */
const withIsolationHeaders = (middleware) => (request, response, next) => {
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  return middleware(request, response, next);
};

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => withIsolationHeaders(middleware),
};

module.exports = config;
