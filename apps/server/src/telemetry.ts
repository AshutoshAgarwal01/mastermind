import type * as AppInsightsTypes from 'applicationinsights';
import { config as loadEnvFile } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

// `applicationinsights` mutates its own `exports.defaultClient` inside setup()/start().
// A plain ESM `import * as appInsights` only captures a one-time snapshot of that binding
// (it never reflects the later mutation), so `defaultClient` stays undefined. `require()`
// returns the real, live CommonJS exports object instead.
const appInsights = createRequire(import.meta.url)('applicationinsights') as typeof AppInsightsTypes;

// Loads apps/server/.env.local (git-ignored, see .env.local.example) for local secrets like
// the App Insights connection string — silently does nothing if the file doesn't exist
// (CI/Azure set the real env var directly). Resolved relative to this file so it works
// whether run via `tsx` from src/ or as compiled dist/.
loadEnvFile({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env.local') });

const CONNECTION_STRING = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

// No-op everywhere below when no connection string is configured (local dev, CI).
let client: AppInsightsTypes.TelemetryClient | null = null;

if (CONNECTION_STRING) {
  appInsights
    .setup(CONNECTION_STRING)
    .setAutoCollectRequests(false)
    .setAutoCollectPerformance(false, false)
    .setAutoCollectDependencies(false)
    .setAutoCollectConsole(false)
    .setAutoCollectExceptions(true)
    .start();
  client = appInsights.defaultClient;
  client.context.tags[client.context.keys.cloudRole] = 'mastermind-server';
}

type Properties = Record<string, string | number | boolean | null | undefined>;

function stringifyProperties(properties: Properties): Record<string, string> {
  const result: Record<string, string> = { environment: ENVIRONMENT };
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null) continue;
    result[key] = String(value);
  }
  return result;
}

export function trackEvent(name: string, properties: Properties = {}): void {
  client?.trackEvent({ name, properties: stringifyProperties(properties) });
}

export function trackException(err: unknown, properties: Properties = {}): void {
  const exception = err instanceof Error ? err : new Error(String(err));
  client?.trackException({ exception, properties: stringifyProperties(properties) });
}
