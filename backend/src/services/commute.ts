import { TransportMode } from "../models/common.js";
import { CommuteEstimate } from "../models/commute.js";

interface ModeBaseline {
  minutes: number;
  monthlyCost: number;
  reliabilityScore: number;
  peakDelayMinutes: number;
}

const BASELINE: Record<TransportMode, ModeBaseline> = {
  [TransportMode.Metro]: { minutes: 28, monthlyCost: 1800, reliabilityScore: 82, peakDelayMinutes: 8 },
  [TransportMode.Bus]: { minutes: 42, monthlyCost: 1200, reliabilityScore: 62, peakDelayMinutes: 18 },
  [TransportMode.Walking]: { minutes: 75, monthlyCost: 0, reliabilityScore: 92, peakDelayMinutes: 0 },
  [TransportMode.Rapido]: { minutes: 26, monthlyCost: 3200, reliabilityScore: 68, peakDelayMinutes: 15 },
  [TransportMode.Uber]: { minutes: 24, monthlyCost: 7200, reliabilityScore: 64, peakDelayMinutes: 20 },
  [TransportMode.Ola]: { minutes: 25, monthlyCost: 7000, reliabilityScore: 63, peakDelayMinutes: 20 },
  [TransportMode.Cityflow]: { minutes: 38, monthlyCost: 2200, reliabilityScore: 70, peakDelayMinutes: 14 },
  [TransportMode.Hexa]: { minutes: 34, monthlyCost: 2600, reliabilityScore: 72, peakDelayMinutes: 12 },
};

export class CommuteService {
  async estimate(
    originName: string = "Selected locality",
    destination: string = "Office",
    modes?: string[] | null
  ): Promise<CommuteEstimate[]> {
    const selectedModes: TransportMode[] =
      modes && modes.length > 0
        ? modes.map((m) => m as TransportMode).filter((m) => Object.values(TransportMode).includes(m))
        : [TransportMode.Metro, TransportMode.Uber, TransportMode.Bus];

    return selectedModes.map((mode) => {
      const data = BASELINE[mode] || {
        minutes: 30,
        monthlyCost: 2000,
        reliabilityScore: 70,
        peakDelayMinutes: 10,
      };

      return {
        mode,
        minutes: data.minutes,
        monthly_cost: data.monthlyCost,
        reliability_score: data.reliabilityScore,
        peak_delay_minutes: data.peakDelayMinutes,
        route_summary: `Estimated ${mode} commute from ${originName} to ${destination}.`,
      };
    });
  }
}
