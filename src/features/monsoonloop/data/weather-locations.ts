/**
 * AQUILOOP — Delhi / NCR Operational Weather Locations & Configured Drainage Thresholds
 *
 * IMPORTANT:
 * - Real hourly weather forecast data (precipitation, probability, temperature, weatherCode)
 *   is fetched server-side from Open-Meteo via the AWS Lambda `weather-ingest` function
 *   and persisted in the `WeatherForecast` DynamoDB table.
 * - `drainCapacityMmPerHour` is a clearly defined application engineering configuration
 *   threshold (never represented as live municipal drainage sensor telemetry).
 */

export interface OperationalWeatherLocation {
  locationKey:
    | "Mayapuri"
    | "Najafgarh"
    | "Dwarka"
    | "Rohini"
    | "Bawana"
    | "Okhla"
    | "Narela"
    | "Delhi";
  locationName: string;
  shortLabel: string;
  wardLabel: string;
  latitude: number;
  longitude: number;
  drainCapacityMmPerHour: number;
}

export const OPERATIONAL_WEATHER_LOCATIONS: OperationalWeatherLocation[] = [
  {
    locationKey: "Mayapuri",
    locationName: "Mayapuri — Subhash Low-Lying Catchment",
    shortLabel: "Mayapuri",
    wardLabel: "Ward 31C · Industrial & Underpass Corridor",
    latitude: 28.6341,
    longitude: 77.1219,
    drainCapacityMmPerHour: 18,
  },
  {
    locationKey: "Najafgarh",
    locationName: "Najafgarh Outfall Sector B",
    shortLabel: "Najafgarh",
    wardLabel: "Ward 44N · Primary Box-Culvert Basin",
    latitude: 28.6139,
    longitude: 77.0322,
    drainCapacityMmPerHour: 21,
  },
  {
    locationKey: "Dwarka",
    locationName: "Dwarka Sector 8 Retention Catchment",
    shortLabel: "Dwarka",
    wardLabel: "Ward 19W · Institutional & Percolation Belt",
    latitude: 28.5733,
    longitude: 77.0688,
    drainCapacityMmPerHour: 25,
  },
  {
    locationKey: "Rohini",
    locationName: "Rohini Sector 11 Stormwater Basin",
    shortLabel: "Rohini",
    wardLabel: "Ward 24N · Urban Detention & Bioswale Belt",
    latitude: 28.7383,
    longitude: 77.0822,
    drainCapacityMmPerHour: 22,
  },
  {
    locationKey: "Bawana",
    locationName: "Bawana Industrial Canal Catchment",
    shortLabel: "Bawana",
    wardLabel: "Ward 08N · Industrial Feeder & Canal Corridor",
    latitude: 28.7972,
    longitude: 77.0343,
    drainCapacityMmPerHour: 19,
  },
  {
    locationKey: "Okhla",
    locationName: "Okhla Floodplain & Outfall Corridor",
    shortLabel: "Okhla",
    wardLabel: "Ward 62S · Yamuna Outfall & Weir Sector",
    latitude: 28.5355,
    longitude: 77.2732,
    drainCapacityMmPerHour: 20,
  },
  {
    locationKey: "Narela",
    locationName: "Narela Agro-Peri-Urban Recharge Belt",
    shortLabel: "Narela",
    wardLabel: "Ward 02N · Peri-Urban Check-Dam & Pond Network",
    latitude: 28.8527,
    longitude: 77.0929,
    drainCapacityMmPerHour: 23,
  },
  {
    locationKey: "Delhi",
    locationName: "Central Delhi — Municipal Hydrological Benchmark",
    shortLabel: "Delhi",
    wardLabel: "NCT Central Benchmark · Regional Reference",
    latitude: 28.6139,
    longitude: 77.209,
    drainCapacityMmPerHour: 20,
  },
];

export function getWeatherLocationConfig(
  locationKeyOrName: string
): OperationalWeatherLocation {
  const normalized = locationKeyOrName.trim().toLowerCase();
  const match = OPERATIONAL_WEATHER_LOCATIONS.find(
    (loc) =>
      loc.locationKey.toLowerCase() === normalized ||
      loc.locationName.toLowerCase().includes(normalized) ||
      normalized.includes(loc.locationKey.toLowerCase())
  );
  return match ?? OPERATIONAL_WEATHER_LOCATIONS[0];
}
