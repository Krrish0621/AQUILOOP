import { createHash, createHmac } from "node:crypto";

export interface WeatherLocationConfig {
  locationKey: string;
  locationName: string;
  latitude: number;
  longitude: number;
  drainCapacityMmPerHour: number;
}

export const WEATHER_LOCATIONS: WeatherLocationConfig[] = [
  {
    locationKey: "Delhi",
    locationName: "Central Delhi — Municipal Hydrological Benchmark",
    latitude: 28.6139,
    longitude: 77.209,
    drainCapacityMmPerHour: 20,
  },
  {
    locationKey: "Mayapuri",
    locationName: "Mayapuri — Subhash Low-Lying Catchment",
    latitude: 28.6341,
    longitude: 77.1219,
    drainCapacityMmPerHour: 18,
  },
  {
    locationKey: "Najafgarh",
    locationName: "Najafgarh Outfall Sector B",
    latitude: 28.6139,
    longitude: 77.0322,
    drainCapacityMmPerHour: 21,
  },
  {
    locationKey: "Dwarka",
    locationName: "Dwarka Sector 8 Retention Catchment",
    latitude: 28.5733,
    longitude: 77.0688,
    drainCapacityMmPerHour: 25,
  },
  {
    locationKey: "Rohini",
    locationName: "Rohini Sector 11 Stormwater Basin",
    latitude: 28.7383,
    longitude: 77.0822,
    drainCapacityMmPerHour: 22,
  },
  {
    locationKey: "Bawana",
    locationName: "Bawana Industrial Canal Catchment",
    latitude: 28.7972,
    longitude: 77.0343,
    drainCapacityMmPerHour: 19,
  },
  {
    locationKey: "Okhla",
    locationName: "Okhla Floodplain & Outfall Corridor",
    latitude: 28.5355,
    longitude: 77.2732,
    drainCapacityMmPerHour: 20,
  },
  {
    locationKey: "Narela",
    locationName: "Narela Agro-Peri-Urban Recharge Belt",
    latitude: 28.8527,
    longitude: 77.0929,
    drainCapacityMmPerHour: 23,
  },
];

interface OpenMeteoHourlyResponse {
  latitude: number;
  longitude: number;
  timezone?: string;
  hourly?: {
    time?: string[];
    precipitation?: (number | null)[];
    precipitation_probability?: (number | null)[];
    temperature_2m?: (number | null)[];
    weather_code?: (number | null)[];
  };
}

interface NormalizedWeatherItem {
  id: string;
  locationKey: string;
  locationName: string;
  latitude: number;
  longitude: number;
  forecastTime: string;
  rainfallMm: number;
  rainProbability: number;
  temperatureC: number;
  weatherCode: number;
  source: string;
  fetchedAt: string;
  createdAt: string;
  updatedAt: string;
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/**
 * Minimal, zero-dependency AWS SigV4 request helper for DynamoDB JSON RPC
 */
async function callDynamoDbRpc(
  target: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const region = process.env.AWS_REGION || "ap-southeast-2";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing AWS Lambda execution role credentials in environment");
  }

  const host = `dynamodb.${region}.amazonaws.com`;
  const endpoint = `https://${host}/`;
  const service = "dynamodb";
  const body = JSON.stringify(payload);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  const headers: Record<string, string> = {
    "content-type": "application/x-amz-json-1.0",
    host,
    "x-amz-date": amzDate,
    "x-amz-target": `DynamoDB_20120810.${target}`,
  };

  if (sessionToken) {
    headers["x-amz-security-token"] = sessionToken;
  }

  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${headers[k]}\n`)
    .join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  headers["Authorization"] =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `DynamoDB ${target} failed (${response.status}): ${text.slice(0, 400)}`
    );
  }

  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

function toDynamoAttributeMap(item: NormalizedWeatherItem) {
  return {
    id: { S: item.id },
    __typename: { S: "WeatherForecast" },
    locationKey: { S: item.locationKey },
    locationName: { S: item.locationName },
    latitude: { N: String(item.latitude) },
    longitude: { N: String(item.longitude) },
    forecastTime: { S: item.forecastTime },
    rainfallMm: { N: String(item.rainfallMm) },
    rainProbability: { N: String(item.rainProbability) },
    temperatureC: { N: String(item.temperatureC) },
    weatherCode: { N: String(item.weatherCode) },
    source: { S: item.source },
    fetchedAt: { S: item.fetchedAt },
    createdAt: { S: item.createdAt },
    updatedAt: { S: item.updatedAt },
  };
}

async function batchUpsertWeatherItems(
  tableName: string,
  items: NormalizedWeatherItem[]
): Promise<number> {
  const BATCH_SIZE = 25;
  let totalWritten = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    let requestItems: Record<string, unknown[]> = {
      [tableName]: chunk.map((item) => ({
        PutRequest: {
          Item: toDynamoAttributeMap(item),
        },
      })),
    };

    let attempt = 0;
    while (
      requestItems[tableName] &&
      requestItems[tableName].length > 0 &&
      attempt < 4
    ) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 150 * Math.pow(2, attempt)));
      }
      const res = await callDynamoDbRpc("BatchWriteItem", {
        RequestItems: requestItems,
      });
      const unprocessed = (res.UnprocessedItems as Record<string, unknown[]>)?.[
        tableName
      ];
      const writtenNow =
        requestItems[tableName].length - (unprocessed?.length ?? 0);
      totalWritten += writtenNow;

      if (unprocessed && unprocessed.length > 0) {
        requestItems = { [tableName]: unprocessed };
        attempt++;
      } else {
        break;
      }
    }
  }

  return totalWritten;
}

async function fetchOpenMeteoForLocation(
  loc: WeatherLocationConfig,
  fetchedAtIso: string
): Promise<NormalizedWeatherItem[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(loc.latitude));
  url.searchParams.set("longitude", String(loc.longitude));
  url.searchParams.set(
    "hourly",
    "precipitation,precipitation_probability,temperature_2m,weather_code"
  );
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("timezone", "Asia/Kolkata");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "AQUILOOP-MonsoonLoop-WeatherIngest/1.0",
    },
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(
      `Open-Meteo request failed for ${loc.locationKey} (${response.status}): ${errBody.slice(0, 200)}`
    );
  }

  const payload = (await response.json()) as OpenMeteoHourlyResponse;
  const times = payload.hourly?.time ?? [];
  const precip = payload.hourly?.precipitation ?? [];
  const prob = payload.hourly?.precipitation_probability ?? [];
  const temp = payload.hourly?.temperature_2m ?? [];
  const codes = payload.hourly?.weather_code ?? [];

  if (!Array.isArray(times) || times.length === 0) {
    throw new Error(
      `Open-Meteo returned empty hourly series for ${loc.locationKey}`
    );
  }

  // Normalize 72-hour window
  const maxHours = Math.min(times.length, 72);
  const normalized: NormalizedWeatherItem[] = [];

  for (let i = 0; i < maxHours; i++) {
    const rawTime = times[i];
    if (!rawTime) continue;

    const rainfallMm = Number(
      Math.max(0, Number(precip[i] ?? 0)).toFixed(2)
    );
    const rainProbability = Number(
      Math.max(0, Math.min(100, Number(prob[i] ?? 0))).toFixed(0)
    );
    const temperatureC = Number(Number(temp[i] ?? 0).toFixed(1));
    const weatherCode = Math.round(Number(codes[i] ?? 0));

    // Deterministic primary key guarantees idempotency per (locationKey + forecastTime)
    const deterministicId = `${loc.locationKey}#${rawTime}`;

    normalized.push({
      id: deterministicId,
      locationKey: loc.locationKey,
      locationName: loc.locationName,
      latitude: loc.latitude,
      longitude: loc.longitude,
      forecastTime: rawTime,
      rainfallMm,
      rainProbability,
      temperatureC,
      weatherCode,
      source: "open-meteo",
      fetchedAt: fetchedAtIso,
      createdAt: fetchedAtIso,
      updatedAt: fetchedAtIso,
    });
  }

  return normalized;
}

interface AppSyncOrScheduledEvent {
  arguments?: {
    locationKey?: string | null;
  };
  locationKey?: string | null;
}

export const handler = async (event: AppSyncOrScheduledEvent = {}) => {
  const tableName = process.env.WEATHER_FORECAST_TABLE_NAME;
  if (!tableName) {
    throw new Error(
      "WEATHER_FORECAST_TABLE_NAME environment variable is not configured"
    );
  }

  const requestedKey =
    event?.arguments?.locationKey?.trim() || event?.locationKey?.trim() || null;

  const targetLocations =
    requestedKey && requestedKey.toUpperCase() !== "ALL"
      ? WEATHER_LOCATIONS.filter(
          (l) => l.locationKey.toLowerCase() === requestedKey.toLowerCase()
        )
      : WEATHER_LOCATIONS;

  if (targetLocations.length === 0) {
    throw new Error(
      `Unsupported locationKey "${requestedKey}". Valid keys: ${WEATHER_LOCATIONS.map((l) => l.locationKey).join(", ")}`
    );
  }

  const fetchedAtIso = new Date().toISOString();
  const allItems: NormalizedWeatherItem[] = [];

  // Fetch Open-Meteo forecasts for target locations concurrently
  const locationResults = await Promise.all(
    targetLocations.map((loc) => fetchOpenMeteoForLocation(loc, fetchedAtIso))
  );

  for (const items of locationResults) {
    allItems.push(...items);
  }

  const recordsUpserted = await batchUpsertWeatherItems(tableName, allItems);

  return {
    success: true,
    locationsProcessed: targetLocations.length,
    recordsUpserted,
    fetchedAt: fetchedAtIso,
    source: "open-meteo",
    message: `Ingested ${recordsUpserted} hourly Open-Meteo forecast records across ${targetLocations.length} location(s).`,
  };
};
