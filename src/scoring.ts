/**
 * TdF Fantasy scoring model.
 *
 * The DEFAULT_SCORING_TABLE is based on publicly documented rules from prior
 * editions of Tour de France Fantasy by Tissot. Verify all values against the
 * official scoring explications page once the 2025 edition goes live.
 *
 * All scoring functions are pure — no I/O, fully testable offline.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type StageType =
  | "flat"
  | "hilly"
  | "mountain_finish"
  | "individual_tt"
  | "team_tt";

export type KomCategory = "hc" | "cat1" | "cat2" | "cat3" | "cat4";

export type Jersey = "yellow" | "green" | "polka_dot" | "white";

export interface ScoringTable {
  /**
   * Points for finishing positions 1–N.
   * Index 0 = 1st place. Positions beyond the array length score 0.
   */
  stageFinishPoints: number[];

  /**
   * Points for placing at intermediate bonus sprints.
   * Index 0 = 1st sprint, 1 = 2nd, 2 = 3rd. Beyond that = 0.
   */
  bonusSprintPoints: [number, number, number];

  /**
   * Points per KOM position, indexed by category.
   * Each entry is an array where index 0 = 1st place.
   */
  komPoints: Record<KomCategory, number[]>;

  /**
   * Bonus points for wearing each classification jersey at a stage.
   */
  jerseyBonusPoints: Record<Jersey, number>;

  /**
   * Multiplier applied to the captain's total stage score.
   * From config: fantasy_coeff_pontdor = 1.2
   */
  captainMultiplier: number;
}

export interface StageRiderResult {
  riderId: number;
  /** 1-based finish position. Omit if DNF/DNS/DSQ. */
  finishPosition?: number;
  /** 1-based positions at each intermediate bonus sprint this stage. */
  bonusSprints: number[];
  /** KOM points earned this stage. */
  komResults: Array<{ category: KomCategory; position: number }>;
  /** Classification jerseys worn at this stage. */
  jerseys: Jersey[];
}

export interface RiderStageScore {
  riderId: number;
  isCapitaine: boolean;
  points: number;
}

export interface TeamStageScore {
  totalPoints: number;
  byRider: RiderStageScore[];
}

// ── Default scoring table ──────────────────────────────────────────────────────

/**
 * TODO: Verify all values against the official scoring rules before the 2025
 * edition goes live. Update this table and bump the version comment if anything
 * changes between editions.
 *
 * Last verified: TdF Fantasy 2024 edition rules.
 */
export const DEFAULT_SCORING_TABLE: ScoringTable = {
  // Stage finish positions 1–20; 21st place onwards scores 0.
  stageFinishPoints: [
    200, 170, 145, 125, 110, // 1–5
     95,  80,  70,  60,  50, // 6–10
     45,  40,  35,  30,  25, // 11–15
     20,  17,  15,  13,  10, // 16–20
  ],

  // Intermediate bonus sprints (bonifications).
  bonusSprintPoints: [25, 15, 8],

  // KOM classification points by category.
  komPoints: {
    hc:   [60, 40, 25, 15, 10, 6, 4],
    cat1: [45, 30, 18, 10,  6],
    cat2: [30, 18, 10,  6],
    cat3: [20, 10,  5],
    cat4: [10,  5],
  },

  // Per-stage jersey bonus (awarded to the rider wearing it that day).
  jerseyBonusPoints: {
    yellow:   50,
    green:    25,
    polka_dot: 20,
    white:    15,
  },

  // From game config: fantasy_coeff_pontdor = 1.2
  captainMultiplier: 1.2,
};

// ── Scoring functions ─────────────────────────────────────────────────────────

export function scoreStageFinish(
  position: number | undefined,
  table: ScoringTable = DEFAULT_SCORING_TABLE
): number {
  if (position === undefined || position < 1) return 0;
  return table.stageFinishPoints[position - 1] ?? 0;
}

export function scoreBonusSprints(
  sprintPositions: number[],
  table: ScoringTable = DEFAULT_SCORING_TABLE
): number {
  return sprintPositions.reduce(
    (sum, pos) => sum + (table.bonusSprintPoints[pos - 1] ?? 0),
    0
  );
}

export function scoreKom(
  category: KomCategory,
  position: number,
  table: ScoringTable = DEFAULT_SCORING_TABLE
): number {
  return table.komPoints[category][position - 1] ?? 0;
}

export function scoreKomResults(
  komResults: StageRiderResult["komResults"],
  table: ScoringTable = DEFAULT_SCORING_TABLE
): number {
  return komResults.reduce(
    (sum, { category, position }) => sum + scoreKom(category, position, table),
    0
  );
}

export function scoreJerseys(
  jerseys: Jersey[],
  table: ScoringTable = DEFAULT_SCORING_TABLE
): number {
  return jerseys.reduce((sum, j) => sum + table.jerseyBonusPoints[j], 0);
}

export function scoreRiderForStage(
  result: StageRiderResult,
  isCapitaine: boolean,
  table: ScoringTable = DEFAULT_SCORING_TABLE
): number {
  const base =
    scoreStageFinish(result.finishPosition, table) +
    scoreBonusSprints(result.bonusSprints, table) +
    scoreKomResults(result.komResults, table) +
    scoreJerseys(result.jerseys, table);
  return isCapitaine ? Math.round(base * table.captainMultiplier) : base;
}

export function scoreTeamForStage(
  teamResults: StageRiderResult[],
  capitaineId: number,
  table: ScoringTable = DEFAULT_SCORING_TABLE
): TeamStageScore {
  const byRider: RiderStageScore[] = teamResults.map((result) => {
    const isCapitaine = result.riderId === capitaineId;
    return {
      riderId: result.riderId,
      isCapitaine,
      points: scoreRiderForStage(result, isCapitaine, table),
    };
  });
  return {
    totalPoints: byRider.reduce((sum, r) => sum + r.points, 0),
    byRider,
  };
}
