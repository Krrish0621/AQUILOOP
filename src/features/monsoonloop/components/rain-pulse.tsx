"use client";

import * as React from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  Gauge,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getShortZoneLocality } from "@/features/monsoonloop/components/zone-selector";
import type {
  ResilienceZone,
  WeatherForecastHourlyPoint,
  ZoneWeatherSummary,
} from "@/types";
import { cn } from "@/lib/utils";

interface RainPulseProps {
  selectedZone: ResilienceZone;
  weatherSummary: ZoneWeatherSummary | null;
  isLoadingWeather?: boolean;
  isRefreshingWeather?: boolean;
  refreshError?: string | null;
  canRefresh?: boolean;
  onRefreshWeather?: () => void;
}

function formatForecastAxisLabel(isoOrLocalTime: string): string {
  const parts = isoOrLocalTime.split("T");
  if (parts.length !== 2) return isoOrLocalTime;
  const datePart = parts[0];
  const timePart = parts[1].slice(0, 5);
  const [, month, day] = datePart.split("-");
  if (!month || !day) return timePart;
  return `${day}/${month} ${timePart}`;
}

function formatLastUpdatedTime(isoString: string | null | undefined): string {
  if (!isoString) return "Pending initial sync";
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return isoString;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function getRainfallIntensityLabel(peakMmHr: number): string {
  if (peakMmHr <= 0) return "Dry Window";
  if (peakMmHr < 2.5) return "Light Rain";
  if (peakMmHr < 15) return "Moderate Rain";
  if (peakMmHr < 35) return "Heavy Rain";
  return "Intense Cloudburst";
}

export function RainPulse({
  selectedZone,
  weatherSummary,
  isLoadingWeather = false,
  isRefreshingWeather = false,
  refreshError = null,
  canRefresh = false,
  onRefreshWeather,
}: RainPulseProps) {
  const locality = getShortZoneLocality(selectedZone.name);
  const configuredCapacityMmHr = selectedZone.drainageCapacityEstimateMmHr;

  const peakMmHr = weatherSummary?.peakRainfallMmHr ?? 0;
  const totalRainMm = weatherSummary?.totalRainfallMm ?? 0;
  const maxProbability = weatherSummary?.maxRainProbability ?? 0;
  const rainyHoursCount = weatherSummary?.rainyHoursCount ?? 0;
  const intensityLabel = getRainfallIntensityLabel(peakMmHr);

  const chartData = React.useMemo(() => {
    const points: WeatherForecastHourlyPoint[] =
      weatherSummary?.hourlyPoints ?? [];

    return points.map((pt) => ({
      id: pt.id,
      forecastTime: pt.forecastTime,
      timeLabel: formatForecastAxisLabel(pt.forecastTime),
      rainfallMm: Number(pt.rainfallMm.toFixed(2)),
      rainProbability: Math.round(pt.rainProbability ?? 0),
      temperatureC: Number((pt.temperatureC ?? 0).toFixed(1)),
    }));
  }, [weatherSummary]);

  const peakPoint = React.useMemo(() => {
    if (chartData.length === 0) return null;
    let best = chartData[0];
    for (const pt of chartData) {
      if (pt.rainfallMm > best.rainfallMm) {
        best = pt;
      }
    }
    return best;
  }, [chartData]);

  // Single unified Y-axis domain that always includes the drainage capacity limit
  const yAxisMax = Math.max(
    configuredCapacityMmHr + 6,
    Math.ceil(peakMmHr + 4)
  );

  const capacityUtilizationPct = Math.min(
    100,
    Math.round((peakMmHr / Math.max(1, configuredCapacityMmHr)) * 100)
  );
  const exceedsCapacity = peakMmHr >= configuredCapacityMmHr;
  const approachesCapacity =
    !exceedsCapacity && peakMmHr >= configuredCapacityMmHr * 0.7;
  const isLowOrDryForecast = peakMmHr < 2.5;

  return (
    <Card className="overflow-hidden h-full flex flex-col justify-between">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CloudRain className="h-4 w-4 text-primary" />
            <CardTitle className="text-base sm:text-lg">
              72-Hour Rainfall Forecast vs. Drainage Capacity
            </CardTitle>
          </div>

          {canRefresh && onRefreshWeather && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isRefreshingWeather}
              onClick={onRefreshWeather}
              className="h-7 gap-1.5 px-2.5 text-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  isRefreshingWeather ? "animate-spin text-primary" : ""
                }`}
              />
              <span>
                {isRefreshingWeather ? "Refreshing..." : "Refresh forecast"}
              </span>
            </Button>
          )}
        </div>

        {/* 3-Column Scannable Forecast vs Drainage Capacity Summary */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface-muted/45 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Peak Rainfall</span>
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="mt-1 font-mono text-base font-bold text-foreground">
              {peakMmHr.toFixed(1)} mm/hr
            </p>
            <p className="text-[11px] text-muted-foreground">
              {peakMmHr > 0 && peakPoint
                ? `Peak around ${peakPoint.timeLabel} IST`
                : "No rain spike (> 0.0 mm/hr) in 72h"}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted/45 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Rainfall Intensity</span>
              <CloudRain className="h-3.5 w-3.5 text-info" />
            </div>
            <p className="mt-1 text-base font-bold text-foreground">
              {intensityLabel}{" "}
              <span className="font-mono text-xs font-normal text-muted-foreground">
                ({totalRainMm.toFixed(1)} mm)
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              {rainyHoursCount > 0
                ? `${rainyHoursCount} rainy hr${rainyHoursCount === 1 ? "" : "s"} · up to ${maxProbability}% probability`
                : `0 rainy hours · up to ${maxProbability}% probability`}
            </p>
          </div>

          <div
            className={cn(
              "rounded-xl border p-3",
              exceedsCapacity
                ? "border-danger/45 bg-danger/10"
                : approachesCapacity
                  ? "border-warning/45 bg-warning/10"
                  : "border-success/35 bg-success/10"
            )}
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Drainage Capacity</span>
              <Gauge
                className={cn(
                  "h-3.5 w-3.5",
                  exceedsCapacity
                    ? "text-danger"
                    : approachesCapacity
                      ? "text-warning"
                      : "text-success"
                )}
              />
            </div>
            <p className="mt-1 font-mono text-base font-bold text-foreground">
              {configuredCapacityMmHr} mm/hr limit
            </p>
            <p
              className={cn(
                "text-[11px] font-medium",
                exceedsCapacity
                  ? "text-danger"
                  : approachesCapacity
                    ? "text-warning"
                    : "text-success"
              )}
            >
              {exceedsCapacity
                ? `Exceeds capacity (${capacityUtilizationPct}% of limit)`
                : approachesCapacity
                  ? `Approaches capacity (${capacityUtilizationPct}% of limit)`
                  : `Below capacity (${capacityUtilizationPct}% of limit)`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <CardDescription className="text-xs">
            Hourly precipitation (<span className="font-mono">mm/hr</span>) and
            rain probability (<span className="font-mono">%</span>) for{" "}
            <strong className="font-medium text-foreground">{locality}</strong>
          </CardDescription>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>Updated: {formatLastUpdatedTime(weatherSummary?.fetchedAt)}</span>
          </div>
        </div>

        {refreshError && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/45 bg-warning/10 px-3 py-2 text-xs text-warning">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Showing last saved forecast. Live refresh failed.
            </span>
            {canRefresh && onRefreshWeather && (
              <button
                type="button"
                onClick={onRefreshWeather}
                disabled={isRefreshingWeather}
                className="text-[11px] font-semibold underline hover:opacity-90"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-1 space-y-3">
        {isLoadingWeather && chartData.length === 0 ? (
          <div className="flex h-[230px] w-full items-center justify-center rounded-xl border border-border bg-surface-muted/30 text-xs text-muted-foreground">
            Loading hourly rainfall forecast...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[230px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface-muted/30 p-4 text-center text-xs text-muted-foreground">
            <span>No forecast data found for {locality} yet.</span>
            {canRefresh && onRefreshWeather && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onRefreshWeather}
                disabled={isRefreshingWeather}
              >
                {isRefreshingWeather
                  ? "Fetching latest forecast..."
                  : "Refresh forecast"}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 14, right: 14, left: -6, bottom: 2 }}
                >
                  <defs>
                    <linearGradient
                      id="rainPulseHourlyGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--chart-rainfall))"
                        stopOpacity={0.42}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--chart-rainfall))"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="timeLabel"
                    minTickGap={28}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 10,
                    }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="rain"
                    domain={[0, yAxisMax]}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                    axisLine={false}
                    tickLine={false}
                    unit=" mm/hr"
                  />
                  <YAxis
                    yAxisId="prob"
                    orientation="right"
                    domain={[0, 100]}
                    hide
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border-strong))",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(
                      value: unknown,
                      name: string,
                      item: {
                        payload?: {
                          rainProbability?: number;
                          temperatureC?: number;
                        };
                      }
                    ) => {
                      if (name === "Hourly Rainfall") {
                        const prob = item?.payload?.rainProbability ?? 0;
                        const temp = item?.payload?.temperatureC;
                        const extra =
                          temp !== undefined
                            ? ` (${prob}% rain probability · ${temp}°C)`
                            : ` (${prob}% rain probability)`;
                        return [
                          `${Number(value).toFixed(2)} mm/hr${extra}`,
                          name,
                        ];
                      }
                      if (name === "Rain Probability") {
                        return [`${Number(value).toFixed(0)}%`, name];
                      }
                      return [String(value), name];
                    }}
                    labelFormatter={(label) =>
                      `Forecast window: ${label} IST · Drainage capacity: ${configuredCapacityMmHr} mm/hr`
                    }
                  />

                  {/* Drainage capacity threshold reference line */}
                  <ReferenceLine
                    yAxisId="rain"
                    y={configuredCapacityMmHr}
                    stroke="hsl(var(--danger))"
                    strokeDasharray="4 4"
                    label={{
                      value: `Drainage capacity: ${configuredCapacityMmHr} mm/hr`,
                      position: "insideTopLeft",
                      fill: "hsl(var(--danger))",
                      fontSize: 10,
                    }}
                  />

                  {/* Rain probability trend so low-rain windows still show atmospheric curve */}
                  <Area
                    yAxisId="prob"
                    type="monotone"
                    dataKey="rainProbability"
                    name="Rain Probability"
                    stroke="hsl(var(--info))"
                    strokeWidth={1.35}
                    strokeDasharray="3 3"
                    fillOpacity={0}
                  />

                  {/* Hourly rainfall area + bars (minPointSize ensures low-rain hours > 0 are visually legible) */}
                  <Area
                    yAxisId="rain"
                    type="monotone"
                    dataKey="rainfallMm"
                    name="Hourly Rainfall"
                    stroke="hsl(var(--chart-rainfall))"
                    strokeWidth={2.2}
                    fill="url(#rainPulseHourlyGrad)"
                  />
                  <Bar
                    yAxisId="rain"
                    dataKey="rainfallMm"
                    name="Hourly Rainfall"
                    fill="hsl(var(--chart-rainfall))"
                    fillOpacity={0.7}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={10}
                    minPointSize={(value) => (value && value > 0 ? 6 : 0)}
                  />

                  {/* Visible Peak Marker when peak > 0 */}
                  {peakPoint && peakPoint.rainfallMm > 0 && (
                    <ReferenceDot
                      yAxisId="rain"
                      x={peakPoint.timeLabel}
                      y={peakPoint.rainfallMm}
                      r={5}
                      fill="hsl(var(--warning))"
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                      label={{
                        value: `Peak: ${peakPoint.rainfallMm.toFixed(1)} mm/hr`,
                        position: "top",
                        fill: "hsl(var(--warning))",
                        fontSize: 10,
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Clear low-rain / dry-window callout so the chart is immediately understandable */}
            {isLowOrDryForecast && (
              <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/8 px-3.5 py-2.5 text-xs text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>
                    {totalRainMm === 0
                      ? `Dry 72-hour forecast window for ${locality} (0.0 mm)`
                      : `Low-rainfall 72-hour forecast for ${locality} (${totalRainMm.toFixed(
                          1
                        )} mm total, ${peakMmHr.toFixed(1)} mm/hr peak)`}
                  </strong>{" "}
                  — Forecast precipitation remains well below the{" "}
                  <strong>{configuredCapacityMmHr} mm/hr</strong> drainage
                  capacity threshold. Pre-storm clearance window is open for
                  preventive drain desilting.
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
