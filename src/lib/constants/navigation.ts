import type { MonsoonPhase } from "@/types";

export interface NavigationItem {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  isHero?: boolean;
  description: string;
}

export const PRIMARY_NAVIGATION: NavigationItem[] = [
  {
    id: "aquiloop-home",
    label: "AQUILOOP",
    shortLabel: "Home",
    href: "/",
    description: "Turn rainfall, waste, and crop residue into local climate action.",
  },
  {
    id: "monsoonloop",
    label: "MONSOONLOOP",
    shortLabel: "MONSOONLOOP",
    href: "/monsoonloop",
    isHero: true,
    description: "Turn rainfall forecasts into pre-storm action.",
  },
  {
    id: "flood-bounties",
    label: "Flood & Waste Bounties",
    shortLabel: "Bounties",
    href: "/flood-bounties",
    description: "Turn blocked-drain waste into verified cleanup work.",
  },
  {
    id: "stubble-exchange",
    label: "Stubble-to-Water",
    shortLabel: "Stubble-to-Water",
    href: "/stubble-exchange",
    description: "Connect crop residue with local buyers and resilience support.",
  },
];

export interface MonsoonTimelineStep {
  phase: MonsoonPhase;
  horizon: string;
  label: string;
  sublabel: string;
  operationalFocus: string;
  countdownBadge: string;
  isPrimaryDefault?: boolean;
}

export const MONSOONLOOP_TIMELINE_STEPS: MonsoonTimelineStep[] = [
  {
    phase: "WATCH_48H",
    horizon: "48h",
    label: "Watch",
    sublabel: "Early Forecast",
    operationalFocus: "Identify vulnerable zones and check water storage readiness",
    countdownBadge: "48h · Watch",
  },
  {
    phase: "PREPARE_24H",
    horizon: "24h",
    label: "Prepare",
    sublabel: "Pre-Clearance",
    operationalFocus: "Inspect blocked storm drains, clear inlets & stage field teams",
    countdownBadge: "24h · Prepare",
    isPrimaryDefault: true,
  },
  {
    phase: "ACTION_12H",
    horizon: "12h",
    label: "Action",
    sublabel: "Active Dispatch",
    operationalFocus: "Dispatch priority drain clearance and open diversion inlets",
    countdownBadge: "12h → Action",
    isPrimaryDefault: true,
  },
  {
    phase: "URGENT_6H",
    horizon: "6h",
    label: "Urgent",
    sublabel: "Rapid Response",
    operationalFocus: "Resolve critical bottleneck drains before peak rainfall arrives",
    countdownBadge: "6h · Urgent",
    isPrimaryDefault: true,
  },
  {
    phase: "NOWCAST_3H",
    horizon: "3h",
    label: "Nowcast",
    sublabel: "Approaching Rain",
    operationalFocus: "Track approaching rain band and route early runoff to storage",
    countdownBadge: "3h · Nowcast",
  },
  {
    phase: "EVENT_0H",
    horizon: "0h",
    label: "Event",
    sublabel: "Active Rainfall",
    operationalFocus: "Monitor live inflow, drain capacity, and active water capture",
    countdownBadge: "Event · Active Rain",
    isPrimaryDefault: true,
  },
  {
    phase: "VERIFY_6H",
    horizon: "+6h",
    label: "Verify",
    sublabel: "Field Evidence",
    operationalFocus: "Review geotagged field photos and verify completed tasks",
    countdownBadge: "+6h · Verify",
  },
  {
    phase: "IMPACT_24H",
    horizon: "+24h",
    label: "Outcome",
    sublabel: "Water Summary",
    operationalFocus: "Review completed tasks, cleared drains, and estimated water benefit",
    countdownBadge: "+24h · Outcome",
  },
];
