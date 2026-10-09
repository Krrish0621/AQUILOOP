import { defineFunction } from "@aws-amplify/backend";

/**
 * AQUILOOP — Real Weather Forecast Ingestion Lambda (Open-Meteo -> DynamoDB)
 *
 * - Runs automatically every 3 hours via Amazon EventBridge Scheduler (`schedule: "every 3h"`)
 * - Also invokable on-demand by authenticated OPERATOR users via the AppSync
 *   `refreshWeatherForecast` mutation
 * - Assigned to the `data` resource group to avoid circular stack dependencies
 */
export const weatherIngest = defineFunction({
  name: "weather-ingest",
  entry: "./handler.ts",
  timeoutSeconds: 60,
  memoryMB: 512,
  schedule: "every 3h",
  resourceGroupName: "data",
});
