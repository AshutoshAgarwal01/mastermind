import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const CONNECTION_STRING = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING;
const ENVIRONMENT = import.meta.env.PROD ? 'production' : 'development';

// No-op everywhere below when no connection string is configured (local dev, CI).
let appInsights: ApplicationInsights | null = null;

if (CONNECTION_STRING) {
  appInsights = new ApplicationInsights({
    config: {
      connectionString: CONNECTION_STRING,
      disableAjaxTracking: true,
      disableFetchTracking: true,
      enableAutoRouteTracking: false,
    },
  });
  appInsights.loadAppInsights();
  appInsights.addTelemetryInitializer((item) => {
    item.data ??= {};
    item.data.environment = ENVIRONMENT;
  });
}

type Properties = Record<string, string | number | boolean | null | undefined>;

export function trackPageView(name: string): void {
  appInsights?.trackPageView({ name });
}

export function trackEvent(name: string, properties: Properties = {}): void {
  appInsights?.trackEvent({ name }, properties);
}

export function trackException(error: Error, properties: Properties = {}): void {
  appInsights?.trackException({ exception: error, properties });
}
