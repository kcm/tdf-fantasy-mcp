import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SCORING_TABLE,
  scoreStageFinish,
  scoreBonusSprints,
  scoreKom,
  scoreKomResults,
  scoreJerseys,
  scoreRiderForStage,
  scoreTeamForStage,
  type StageRiderResult,
  type ScoringTable,
} from "../scoring.js";

describe("scoreStageFinish", () => {
  it("returns correct points for positions 1–5", () => {
    assert.equal(scoreStageFinish(1), 200);
    assert.equal(scoreStageFinish(2), 170);
    assert.equal(scoreStageFinish(3), 145);
    assert.equal(scoreStageFinish(4), 125);
    assert.equal(scoreStageFinish(5), 110);
  });

  it("returns correct points for position 20", () => {
    assert.equal(scoreStageFinish(20), 10);
  });

  it("returns 0 for positions beyond the table", () => {
    assert.equal(scoreStageFinish(21), 0);
    assert.equal(scoreStageFinish(100), 0);
  });

  it("returns 0 for DNF (undefined position)", () => {
    assert.equal(scoreStageFinish(undefined), 0);
  });

  it("returns 0 for invalid position 0", () => {
    assert.equal(scoreStageFinish(0), 0);
  });

  it("respects a custom scoring table", () => {
    const custom: ScoringTable = {
      ...DEFAULT_SCORING_TABLE,
      stageFinishPoints: [500, 300],
    };
    assert.equal(scoreStageFinish(1, custom), 500);
    assert.equal(scoreStageFinish(2, custom), 300);
    assert.equal(scoreStageFinish(3, custom), 0);
  });
});

describe("scoreBonusSprints", () => {
  it("scores a 1st-place sprint correctly", () => {
    assert.equal(scoreBonusSprints([1]), 25);
  });

  it("accumulates multiple sprint results", () => {
    // 1st + 2nd + 3rd sprint = 25 + 15 + 8
    assert.equal(scoreBonusSprints([1, 2, 3]), 48);
  });

  it("returns 0 for empty array", () => {
    assert.equal(scoreBonusSprints([]), 0);
  });

  it("returns 0 for positions beyond the table (4th+)", () => {
    assert.equal(scoreBonusSprints([4]), 0);
  });
});

describe("scoreKom", () => {
  it("scores HC 1st place correctly", () => {
    assert.equal(scoreKom("hc", 1), 60);
  });

  it("scores cat1 3rd place correctly", () => {
    assert.equal(scoreKom("cat1", 3), 18);
  });

  it("scores cat4 2nd place correctly", () => {
    assert.equal(scoreKom("cat4", 2), 5);
  });

  it("returns 0 for position beyond category table", () => {
    assert.equal(scoreKom("cat4", 3), 0);
  });
});

describe("scoreKomResults", () => {
  it("accumulates multiple KOM results", () => {
    // HC 1st (60) + cat1 1st (45) = 105
    const results: StageRiderResult["komResults"] = [
      { category: "hc", position: 1 },
      { category: "cat1", position: 1 },
    ];
    assert.equal(scoreKomResults(results), 105);
  });

  it("returns 0 for empty results", () => {
    assert.equal(scoreKomResults([]), 0);
  });
});

describe("scoreJerseys", () => {
  it("scores yellow jersey correctly", () => {
    assert.equal(scoreJerseys(["yellow"]), 50);
  });

  it("accumulates multiple jerseys", () => {
    // yellow (50) + green (25) = 75
    assert.equal(scoreJerseys(["yellow", "green"]), 75);
  });

  it("returns 0 for no jerseys", () => {
    assert.equal(scoreJerseys([]), 0);
  });
});

describe("scoreRiderForStage", () => {
  const plainResult: StageRiderResult = {
    riderId: 1,
    finishPosition: 1,
    bonusSprints: [],
    komResults: [],
    jerseys: [],
  };

  it("scores a stage winner with no extras", () => {
    assert.equal(scoreRiderForStage(plainResult, false), 200);
  });

  it("applies captain multiplier and rounds", () => {
    // 200 * 1.2 = 240
    assert.equal(scoreRiderForStage(plainResult, true), 240);
  });

  it("sums all scoring components", () => {
    const result: StageRiderResult = {
      riderId: 2,
      finishPosition: 3,        // 145
      bonusSprints: [1],        // 25
      komResults: [{ category: "cat2", position: 1 }], // 30
      jerseys: ["polka_dot"],   // 20
    };
    // 145 + 25 + 30 + 20 = 220
    assert.equal(scoreRiderForStage(result, false), 220);
  });

  it("scores a DNF as 0 base finish, still counts bonuses", () => {
    const dnfResult: StageRiderResult = {
      riderId: 3,
      finishPosition: undefined,
      bonusSprints: [2], // 15
      komResults: [],
      jerseys: [],
    };
    assert.equal(scoreRiderForStage(dnfResult, false), 15);
  });
});

describe("scoreTeamForStage", () => {
  const results: StageRiderResult[] = [
    { riderId: 10, finishPosition: 1, bonusSprints: [], komResults: [], jerseys: ["yellow"] },
    { riderId: 20, finishPosition: 5, bonusSprints: [], komResults: [], jerseys: [] },
    { riderId: 30, finishPosition: undefined, bonusSprints: [], komResults: [], jerseys: [] },
  ];

  it("sums all rider scores", () => {
    // Rider 10: 200 (finish) + 50 (yellow) = 250
    // Rider 20: 110
    // Rider 30: 0
    // Total: 360
    const score = scoreTeamForStage(results, 99 /* no captain */);
    assert.equal(score.totalPoints, 360);
    assert.equal(score.byRider.length, 3);
  });

  it("applies captain multiplier to the correct rider", () => {
    // Rider 10 as captain: (200 + 50) * 1.2 = 300
    // Others unchanged: 110 + 0 = 110
    // Total: 410
    const score = scoreTeamForStage(results, 10);
    assert.equal(score.totalPoints, 410);
    assert.equal(
      score.byRider.find((r) => r.riderId === 10)?.isCapitaine,
      true
    );
    assert.equal(score.byRider.find((r) => r.riderId === 10)?.points, 300);
  });

  it("returns correct structure when team is empty", () => {
    const score = scoreTeamForStage([], 1);
    assert.equal(score.totalPoints, 0);
    assert.deepEqual(score.byRider, []);
  });
});
