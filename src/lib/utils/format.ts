/**
 * Number & metric formatting utilities for AQUILOOP telemetry panels.
 */

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits,
  }).format(value);
}

export function formatCompactVolumeKl(kiloLiters: number): string {
  if (kiloLiters >= 1000) {
    return `${(kiloLiters / 1000).toFixed(2)} ML`;
  }
  return `${formatNumber(kiloLiters)} kL`;
}

export function formatHorizonLabel(hours: number): string {
  if (hours === 0) return "0h EVENT";
  if (hours > 0) return `T-${hours}h`;
  return `T+${Math.abs(hours)}h`;
}
