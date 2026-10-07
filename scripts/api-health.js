#!/usr/bin/env node
/**
 * Read-only API health probe.
 *
 *   node scripts/api-health.js [baseUrl]      default: https://raahehaq.com/api
 *
 * Only sends unauthenticated GET requests. Never logs in, never writes.
 * Prints status, latency and response *shape* (keys, array lengths), never values,
 * so no user data ends up in the terminal.
 */
/* global AbortSignal */ // Node 18+ global; not in ESLint's node env list
const BASE = (process.argv[2] || 'https://raahehaq.com/api').replace(/\/$/, '');

// expect: 'public' = should be 200 without a token; 'auth' = should be 401 without a token
const CHECKS = [
  ['base', '/', 'any'],
  ['unknown route', '/__health_probe_does_not_exist', '404'],
  ['public banners', '/public/banners', 'public'],
  ['public landing stats', '/public/landing-stats', 'public'],
  ['public settings', '/settings/public', 'public'],
  ['current user', '/user', 'auth'],
  ['auth profile', '/auth/profile', 'auth'],
  ['rides list', '/rides', 'auth'],
  ['rides by passenger 11', '/rides?passenger_id=11', 'auth'],
  ['ride 1', '/rides/1', 'auth'],
  ['pending rides', '/rides/pending?driver_id=1&latitude=24.86&longitude=67.0', 'auth'],
  ['nearby drivers', '/rides/nearby-drivers?latitude=24.86&longitude=67.0&radius=5', 'auth'],
  ['notifications', '/notifications', 'auth'],
  ['users (admin)', '/users', 'auth'],
  ['analytics (admin)', '/analytics/dashboard', 'auth'],
  ['security logs (admin)', '/security/audit-logs', 'auth'],
  ['payments (admin)', '/payments/transactions', 'auth'],
  ['driver latest location', '/tracking/driver/1/latest', 'auth'],
  ['websocket events', '/websocket/events', 'auth'],
];

function shape(value, depth = 0) {
  if (Array.isArray(value)) {
    return `array(${value.length})${value.length && depth < 1 ? ' of ' + shape(value[0], depth + 1) : ''}`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (depth >= 1) {
      return `{${keys.slice(0, 8).join(',')}${keys.length > 8 ? ',…' : ''}}`;
    }
    return '{' + keys.slice(0, 10).map(k => `${k}:${shape(value[k], depth + 1)}`).join(', ') + '}';
  }
  return typeof value;
}

async function probe([name, path, expect]) {
  const started = Date.now();
  try {
    const res = await fetch(BASE + path, {
      headers: {Accept: 'application/json'},
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    const ms = Date.now() - started;
    const type = res.headers.get('content-type') || '';
    const text = await res.text();
    let body = null;
    let bodyInfo;
    if (type.includes('json')) {
      try {
        body = JSON.parse(text);
        bodyInfo = shape(body);
      } catch {
        bodyInfo = 'invalid JSON';
      }
    } else {
      bodyInfo = `${type.split(';')[0] || 'no content-type'} (${text.length} bytes)`;
    }
    const message = body && typeof body.message === 'string' ? body.message.slice(0, 60) : '';

    let verdict = 'ok';
    if (expect === 'auth' && res.status === 200) verdict = 'LEAK: data without token';
    else if (expect === 'auth' && res.status !== 401) verdict = `expected 401`;
    else if (expect === 'public' && res.status !== 200) verdict = 'expected 200';
    else if (expect === '404' && res.status !== 404) verdict = 'expected 404';
    if (res.status >= 500) verdict = 'SERVER ERROR';
    if (expect !== 'any' && !type.includes('json') && res.status !== 301 && res.status !== 302) {
      verdict += verdict === 'ok' ? '' : '';
      if (verdict === 'ok') verdict = 'ok (non-JSON)';
    }
    return {name, path, status: res.status, ms, verdict, bodyInfo, message, location: res.headers.get('location')};
  } catch (e) {
    return {name, path, status: 'ERR', ms: Date.now() - started, verdict: 'UNREACHABLE', bodyInfo: e.cause?.code || e.name, message: ''};
  }
}

(async () => {
  console.log(`API health: ${BASE}  (${new Date().toISOString()})\n`);
  const results = [];
  for (const c of CHECKS) {
    results.push(await probe(c));
  }
  for (const r of results) {
    console.log(`${String(r.status).padEnd(4)} ${String(r.ms + 'ms').padStart(7)}  ${r.verdict.padEnd(26)} ${r.name.padEnd(24)} ${r.path}`);
    console.log(`     body: ${r.bodyInfo}${r.message ? `  message: "${r.message}"` : ''}${r.location ? `  → ${r.location}` : ''}`);
  }
  const bad = results.filter(r => !r.verdict.startsWith('ok'));
  console.log(`\n${results.length - bad.length}/${results.length} as expected`);
  process.exit(bad.length ? 1 : 0);
})();
