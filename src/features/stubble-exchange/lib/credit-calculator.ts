import type { StubbleCondition, StubbleCropType } from "@/types";

/**
 * Deterministic local credit calculation for Stubble-to-Water Exchange.
 * Base rate: 100 ARC per 1.0 tonne of verified recovered crop residue
 * (e.g., 1.8 t stubble recovered => +180 ARC).
 *
 * IMPORTANT: ARC is a digital demo credit, NOT actual currency or financial payout.
 */
export const BASE_ARC_PER_TONNE = 100;

export function calculateExpectedStubbleArc(params: {
  quantity: number;
  unit: "tonnes" | "kg";
  cropType?: StubbleCropType;
  condition?: StubbleCondition;
}): {
  quantityTonnes: number;
  expectedArc: number;
  formulaLabel: string;
  resilienceSupportNote: string;
} {
  const rawTonnes =
    params.unit === "kg" ? params.quantity / 1000 : params.quantity;
  const quantityTonnes = Math.max(0.1, Number(rawTonnes.toFixed(2)));

  const expectedArc = Math.round(quantityTonnes * BASE_ARC_PER_TONNE);

  return {
    quantityTonnes,
    expectedArc,
    formulaLabel: `${quantityTonnes} t × ${BASE_ARC_PER_TONNE} ARC/t = +${expectedArc} ARC`,
    resilienceSupportNote:
      "Credits can be directed toward water-resilience support and pre-monsoon catchment preparedness (digital demo credit only).",
  };
}
