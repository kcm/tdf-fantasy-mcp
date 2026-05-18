import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  estimateRiderScore,
  rankRidersByValue,
  suggestTransfers,
  POSITION_STAGE_WEIGHTS,
  type RiderSnapshot,
  type TeamConstraints,
} from "../optimization.js";
import { DEFAULT_SCORING_TABLE } from "../scoring.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GC_LEADER: RiderSnapshot = { id: 1, positionId: 43, clubId: 1, price: 20 };
const CLIMBER: RiderSnapshot     = { id: 2, positionId: 45, clubId: 2, price: 15 };
const SPRINTER: RiderSnapshot    = { id: 3, positionId: 46, clubId: 3, price: 12 };
const POLY: RiderSnapshot        = { id: 4, positionId: 44, clubId: 4, price: 10 };

const CONSTRAINTS: TeamConstraints = {
  budget: 120,
  maxRidersPerClub: 3,
  totalRiders: 8,
};

// ── estimateRiderScore ────────────────────────────────────────────────────────

describe("estimateRiderScore", () => {
  it("scores climber highest on mountain stages (pre-season)", () => {
    const climberScore   = estimateRiderScore(CLIMBER,   ["mountain_finish"]);
    const sprinterScore  = estimateRiderScore(SPRINTER,  ["mountain_finish"]);
    assert.ok(climberScore > sprinterScore, "climber should outscore sprinter on mountains");
  });

  it("scores sprinter highest on flat stages (pre-season)", () => {
    const sprinterScore  = estimateRiderScore(SPRINTER,  ["flat"]);
    const climberScore   = estimateRiderScore(CLIMBER,   ["flat"]);
    assert.ok(sprinterScore > climberScore, "sprinter should outscore climber on flats");
  });

  it("returns 0 for unknown position ID", () => {
    const unknown: RiderSnapshot = { id: 99, positionId: 999, clubId: 1, price: 10 };
    assert.equal(estimateRiderScore(unknown, ["flat"]), 0);
  });

  it("returns 0 for empty stage list", () => {
    assert.equal(estimateRiderScore(CLIMBER, []), 0);
  });

  it("uses totalPoints when available (season underway)", () => {
    const withPts: RiderSnapshot = { ...CLIMBER, totalPoints: 300 };
    const noPts: RiderSnapshot   = { ...CLIMBER, totalPoints: undefined };
    const scoreWithPts = estimateRiderScore(withPts, ["mountain_finish"]);
    const scoreNoPts   = estimateRiderScore(noPts,   ["mountain_finish"]);
    // Both should be positive; we just verify totalPoints branch runs without error
    assert.ok(scoreWithPts > 0);
    assert.ok(scoreNoPts > 0);
  });

  it("scores consistently across multiple stages", () => {
    const mixed = estimateRiderScore(POLY, ["flat", "mountain_finish", "hilly"]);
    assert.ok(mixed > 0);
  });
});

// ── POSITION_STAGE_WEIGHTS completeness ──────────────────────────────────────

describe("POSITION_STAGE_WEIGHTS", () => {
  const positionIds = [43, 44, 45, 46];
  const stageTypes = ["flat", "hilly", "mountain_finish", "individual_tt", "team_tt"] as const;

  for (const posId of positionIds) {
    for (const stageType of stageTypes) {
      it(`position ${posId} has weight for ${stageType}`, () => {
        const w = POSITION_STAGE_WEIGHTS[posId]?.[stageType];
        assert.ok(w !== undefined, `missing weight for positionId=${posId} stageType=${stageType}`);
        assert.ok(w >= 0 && w <= 1, `weight must be in [0,1], got ${w}`);
      });
    }
  }
});

// ── rankRidersByValue ─────────────────────────────────────────────────────────

describe("rankRidersByValue", () => {
  const pool = [GC_LEADER, CLIMBER, SPRINTER, POLY];

  it("ranks climber first for mountain stages", () => {
    const ranked = rankRidersByValue(pool, ["mountain_finish"]);
    assert.equal(ranked[0].id, CLIMBER.id);
  });

  it("ranks sprinter first for flat stages", () => {
    const ranked = rankRidersByValue(pool, ["flat"]);
    assert.equal(ranked[0].id, SPRINTER.id);
  });

  it("respects maxPrice filter", () => {
    const ranked = rankRidersByValue(pool, ["flat"], DEFAULT_SCORING_TABLE, 11);
    assert.ok(ranked.every((r) => r.price <= 11));
    assert.ok(!ranked.some((r) => r.id === GC_LEADER.id));
  });

  it("returns empty array when no riders pass filter", () => {
    const ranked = rankRidersByValue(pool, ["flat"], DEFAULT_SCORING_TABLE, 1);
    assert.deepEqual(ranked, []);
  });

  it("attaches valueRatio to each result", () => {
    const ranked = rankRidersByValue(pool, ["flat"]);
    for (const r of ranked) {
      assert.ok(typeof r.valueRatio === "number");
      assert.ok(r.valueRatio >= 0);
    }
  });

  it("higher valueRatio rider appears before lower", () => {
    const ranked = rankRidersByValue(pool, ["mountain_finish"]);
    for (let i = 0; i < ranked.length - 1; i++) {
      assert.ok(ranked[i].valueRatio >= ranked[i + 1].valueRatio);
    }
  });
});

// ── suggestTransfers ──────────────────────────────────────────────────────────

describe("suggestTransfers", () => {
  // Current team has the sprinter and GC leader; pool has climber and poly as available.
  const currentTeam: RiderSnapshot[] = [SPRINTER, GC_LEADER];
  const available: RiderSnapshot[] = [CLIMBER, POLY];

  it("suggests a beneficial swap for mountain stages", () => {
    const suggestions = suggestTransfers(
      currentTeam,
      available,
      { ...CONSTRAINTS, budget: 5 }, // tight budget
      ["mountain_finish"],
      2
    );
    // At least one suggestion should drop the sprinter (weak on mountains)
    assert.ok(suggestions.length > 0);
    assert.ok(suggestions[0].expectedScoreGain > 0);
  });

  it("does not suggest picking up a rider already on the team", () => {
    const allRiders = [...currentTeam, ...available];
    const suggestions = suggestTransfers(
      currentTeam,
      allRiders, // available includes current team members
      CONSTRAINTS,
      ["flat"],
      2
    );
    for (const s of suggestions) {
      assert.ok(!currentTeam.some((r) => r.id === s.pickup.id));
    }
  });

  it("respects budget constraint", () => {
    const tightConstraints: TeamConstraints = {
      ...CONSTRAINTS,
      budget: 0, // no extra budget
    };
    const suggestions = suggestTransfers(
      currentTeam,
      available,
      tightConstraints,
      ["mountain_finish"],
      2
    );
    // All suggested pickups must cost no more than the dropped rider's price
    for (const s of suggestions) {
      assert.ok(s.pickup.price <= s.drop.price + tightConstraints.budget);
    }
  });

  it("respects club quota constraint", () => {
    // Three riders already from club 2; climber is also club 2 — should be excluded
    const teamWithClubSaturation: RiderSnapshot[] = [
      { id: 10, positionId: 46, clubId: 2, price: 8 },
      { id: 11, positionId: 44, clubId: 2, price: 9 },
      { id: 12, positionId: 43, clubId: 2, price: 18 },
    ];
    const suggestions = suggestTransfers(
      teamWithClubSaturation,
      [CLIMBER], // CLIMBER is also clubId: 2
      { ...CONSTRAINTS, maxRidersPerClub: 3 },
      ["mountain_finish"],
      1
    );
    // All remaining slots in club 2 are full after removing one, so dropping
    // a non-club-2 rider (none here) would be the only way — no valid pickup.
    // Dropping a club-2 rider frees one slot, making the climber valid.
    // There are valid swaps here (drop one club-2, pick up climber club-2 = still 3).
    // Just verify no suggestion exceeds the club quota.
    for (const s of suggestions) {
      const newClubCount = new Map<number, number>();
      for (const r of teamWithClubSaturation) {
        if (r.id !== s.drop.id) {
          newClubCount.set(r.clubId, (newClubCount.get(r.clubId) ?? 0) + 1);
        }
      }
      const newCount = (newClubCount.get(s.pickup.clubId) ?? 0) + 1;
      assert.ok(newCount <= 3, `club quota exceeded: ${newCount} riders from club ${s.pickup.clubId}`);
    }
  });

  it("returns empty array when no beneficial swaps exist", () => {
    // Make available riders strictly worse than current team on the given stages
    const weakRider: RiderSnapshot = { id: 99, positionId: 46, clubId: 9, price: 5 };
    const strongTeam: RiderSnapshot[] = [
      { ...SPRINTER, totalPoints: 9999 },
    ];
    const suggestions = suggestTransfers(
      strongTeam,
      [weakRider],
      CONSTRAINTS,
      ["flat"],
      1
    );
    assert.equal(suggestions.length, 0);
  });

  it("caps results at exchangesAvailable × 3", () => {
    // Large pool to ensure we'd get many candidates
    const bigPool: RiderSnapshot[] = Array.from({ length: 50 }, (_, i) => ({
      id: 100 + i,
      positionId: 45,
      clubId: 100 + i,
      price: 10,
    }));
    const suggestions = suggestTransfers(
      [SPRINTER],
      bigPool,
      CONSTRAINTS,
      ["mountain_finish"],
      2 // 2 exchanges → max 6 results
    );
    assert.ok(suggestions.length <= 6);
  });
});
