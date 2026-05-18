/**
 * Transfer optimization and rider ranking for TdF Fantasy.
 *
 * Strategy: greedy heuristic — rank riders by expected_score / price for
 * upcoming stages, then surface the highest-gain single swaps.
 *
 * The POSITION_STAGE_WEIGHTS table encodes how well each position type
 * typically performs on each stage type. These weights should be calibrated
 * with actual historical scoring data once the game goes live; for now they
 * represent reasonable priors based on cycling knowledge.
 *
 * All functions are pure — no I/O, fully testable offline.
 */

import { ScoringTable, StageType, DEFAULT_SCORING_TABLE } from "./scoring.js";

// ── Position × stage-type compatibility ───────────────────────────────────────

/**
 * Weights (0–1) representing how well each position type typically scores on
 * each stage type, relative to their best stage type.
 *
 * Position IDs from the game:
 *   43 = Leaders (GC contenders)
 *   44 = Polyvalents (all-rounders)
 *   45 = Grimpeurs (climbers)
 *   46 = Sprinteurs (sprinters)
 *
 * TODO: Refine these weights with actual historical point data after launch.
 */
export const POSITION_STAGE_WEIGHTS: Record<number, Record<StageType, number>> =
  {
    43 /* Leaders */: {
      flat: 0.25,
      hilly: 0.55,
      mountain_finish: 0.90,
      individual_tt: 0.95,
      team_tt: 0.50,
    },
    44 /* Polyvalents */: {
      flat: 0.55,
      hilly: 0.80,
      mountain_finish: 0.65,
      individual_tt: 0.60,
      team_tt: 0.60,
    },
    45 /* Grimpeurs */: {
      flat: 0.10,
      hilly: 0.45,
      mountain_finish: 1.00,
      individual_tt: 0.20,
      team_tt: 0.30,
    },
    46 /* Sprinteurs */: {
      flat: 1.00,
      hilly: 0.65,
      mountain_finish: 0.10,
      individual_tt: 0.40,
      team_tt: 0.70,
    },
  };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RiderSnapshot {
  id: number;
  positionId: number; // 43/44/45/46
  clubId: number;
  /** Price in millions (e.g. 14.5 = 14.5M) */
  price: number;
  /** Accumulated fantasy points this season. Undefined before the season starts. */
  totalPoints?: number;
}

export interface RankedRider extends RiderSnapshot {
  /** Expected score across the upcoming stages (raw, before dividing by price) */
  expectedScore: number;
  /** expectedScore / price — the primary sort key */
  valueRatio: number;
}

export interface TeamConstraints {
  /** Remaining budget in millions */
  budget: number;
  /** Max riders from the same pro team (from config: fantasy_quotaparclub = 3) */
  maxRidersPerClub: number;
  /** Total roster size (from config: fantasy_nbtitulaires = 8) */
  totalRiders: number;
}

export interface TransferSuggestion {
  drop: RiderSnapshot;
  pickup: RiderSnapshot;
  /** Positive = frees up budget; negative = costs more budget */
  budgetDelta: number;
  /** Estimated score gain for the upcoming stages */
  expectedScoreGain: number;
}

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Estimate a rider's total score across a set of upcoming stages.
 *
 * When the season is live, `totalPoints` divided by stages played gives a
 * per-stage average, which we then weight by terrain compatibility.
 *
 * Before the season (or for new riders), we fall back to a price-proxy:
 * higher-priced riders are assumed to be stronger.
 */
export function estimateRiderScore(
  rider: RiderSnapshot,
  upcomingStageTypes: StageType[],
  _table: ScoringTable = DEFAULT_SCORING_TABLE
): number {
  if (upcomingStageTypes.length === 0) return rider.totalPoints ?? 0;

  const weights = POSITION_STAGE_WEIGHTS[rider.positionId];
  if (!weights) return 0;

  if (rider.totalPoints !== undefined && rider.totalPoints > 0) {
    // Season is underway: scale historical average by terrain compatibility
    const ptPerStage = rider.totalPoints / upcomingStageTypes.length;
    const avgWeight =
      upcomingStageTypes.reduce((sum, t) => sum + (weights[t] ?? 0), 0) /
      upcomingStageTypes.length;
    return ptPerStage * avgWeight * upcomingStageTypes.length;
  }

  // Pre-season: use price as quality proxy (price roughly tracks rider strength)
  // Scale so a 20M rider on perfect terrain ~ 100 pts per stage baseline.
  const PRICE_TO_PTS_SCALE = 5;
  return upcomingStageTypes.reduce(
    (sum, t) => sum + rider.price * PRICE_TO_PTS_SCALE * (weights[t] ?? 0),
    0
  );
}

/**
 * Rank available riders by value (expected score per million) for the
 * given upcoming stage types.
 *
 * @param riders        Full pool to rank (e.g. all available non-owned riders)
 * @param upcomingStageTypes  Stage types for the window being optimised
 * @param table         Scoring table (defaults to DEFAULT_SCORING_TABLE)
 * @param maxPrice      Optional upper price filter
 * @returns Riders sorted best-value-first
 */
export function rankRidersByValue(
  riders: RiderSnapshot[],
  upcomingStageTypes: StageType[],
  table: ScoringTable = DEFAULT_SCORING_TABLE,
  maxPrice?: number
): RankedRider[] {
  return riders
    .filter((r) => maxPrice === undefined || r.price <= maxPrice)
    .map((rider) => {
      const expectedScore = estimateRiderScore(rider, upcomingStageTypes, table);
      return {
        ...rider,
        expectedScore,
        valueRatio: rider.price > 0 ? expectedScore / rider.price : 0,
      };
    })
    .sort((a, b) => b.valueRatio - a.valueRatio);
}

/**
 * Suggest the best single-swap transfers given the current team, available
 * riders, constraints, and upcoming stage types.
 *
 * Returns up to `exchangesAvailable × 3` candidates sorted by expected score
 * gain — giving the caller a few options per exchange slot rather than just
 * one.
 *
 * Constraints enforced:
 *   - Cannot pick up a rider already on the team
 *   - Cannot exceed budget after the swap
 *   - Cannot exceed maxRidersPerClub for the incoming rider's club
 */
export function suggestTransfers(
  currentTeam: RiderSnapshot[],
  availableRiders: RiderSnapshot[],
  constraints: TeamConstraints,
  upcomingStageTypes: StageType[],
  exchangesAvailable: number,
  table: ScoringTable = DEFAULT_SCORING_TABLE
): TransferSuggestion[] {
  const currentIds = new Set(currentTeam.map((r) => r.id));

  // Pre-compute club counts for the current team.
  const clubCount = new Map<number, number>();
  for (const r of currentTeam) {
    clubCount.set(r.clubId, (clubCount.get(r.clubId) ?? 0) + 1);
  }

  // Pre-compute scores for current team members.
  const currentScores = new Map(
    currentTeam.map((r) => [r.id, estimateRiderScore(r, upcomingStageTypes, table)])
  );

  const suggestions: TransferSuggestion[] = [];

  for (const drop of currentTeam) {
    const dropScore = currentScores.get(drop.id) ?? 0;
    const budgetAfterDrop = constraints.budget + drop.price;

    // Club counts if this rider were removed.
    const clubCountWithoutDrop = new Map(clubCount);
    clubCountWithoutDrop.set(drop.clubId, (clubCount.get(drop.clubId) ?? 1) - 1);

    for (const pickup of availableRiders) {
      if (currentIds.has(pickup.id)) continue;
      if (pickup.price > budgetAfterDrop) continue;

      const clubUsage = clubCountWithoutDrop.get(pickup.clubId) ?? 0;
      if (clubUsage >= constraints.maxRidersPerClub) continue;

      const pickupScore = estimateRiderScore(pickup, upcomingStageTypes, table);
      const gain = pickupScore - dropScore;
      if (gain <= 0) continue;

      suggestions.push({
        drop,
        pickup,
        budgetDelta: drop.price - pickup.price,
        expectedScoreGain: gain,
      });
    }
  }

  // Return top candidates, capped at exchangesAvailable × 3.
  return suggestions
    .sort((a, b) => b.expectedScoreGain - a.expectedScoreGain)
    .slice(0, Math.max(1, exchangesAvailable) * 3);
}
