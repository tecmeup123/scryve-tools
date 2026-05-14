import {
  calculateSplit,
  calculateDynamicSplit,
  calculateReferralSplit,
  shannonsToCkb,
  ckbToShannons,
  DEFAULT_MIN_CELL_CAPACITY,
  SHANNONS_PER_CKB,
} from "./index";

describe("calculateSplit", () => {
  it("performs a clean 90/10 split on 1000 CKB — both shares above minimum", () => {
    // 1000 CKB: recipient=900, platform=100 — both exceed the 63 CKB minimum
    const result = calculateSplit(1000, 90, 10);
    expect(result.isValid).toBe(true);
    expect(result.wasAdjusted).toBe(false);
    expect(result.recipientCkb).toBeCloseTo(900, 0);
    expect(result.platformCkb).toBeCloseTo(100, 0);
    expect(result.recipientCkb + result.platformCkb).toBeLessThanOrEqual(1000);
  });

  it("adjusts when platform share falls below minimum cell capacity", () => {
    // 99% to recipient on 200 CKB → platform share = 2 CKB < 63 CKB minimum
    const result = calculateSplit(200, 99, 1, 63);
    expect(result.isValid).toBe(true);
    expect(result.wasAdjusted).toBe(true);
    expect(result.platformCkb).toBeGreaterThanOrEqual(63);
  });

  it("adjusts when recipient share falls below minimum cell capacity", () => {
    const result = calculateSplit(200, 1, 99, 63);
    expect(result.isValid).toBe(true);
    expect(result.wasAdjusted).toBe(true);
    expect(result.recipientCkb).toBeGreaterThanOrEqual(63);
  });

  it("returns invalid when total is below 2 * minCellCapacity", () => {
    // 2 * 63 = 126, so 100 CKB is not enough
    const result = calculateSplit(100, 90, 10, 63);
    expect(result.isValid).toBe(false);
    expect(result.recipientCkb).toBe(0);
    expect(result.platformCkb).toBe(0);
    expect(result.invalidReason).toBeTruthy();
  });

  it("uses DEFAULT_MIN_CELL_CAPACITY (63) by default", () => {
    expect(DEFAULT_MIN_CELL_CAPACITY).toBe(63);
    const result = calculateSplit(100, 90, 10);
    expect(result.isValid).toBe(false); // 100 < 126
  });

  it("records the original percentages", () => {
    const result = calculateSplit(200, 85, 15);
    expect(result.originalRecipientPercent).toBe(85);
    expect(result.originalPlatformPercent).toBe(15);
  });
});

describe("calculateDynamicSplit", () => {
  it("handles different minimums for each recipient", () => {
    const result = calculateDynamicSplit(200, 90, 10, 61, 61);
    expect(result.isValid).toBe(true);
    expect(result.recipientCkb + result.platformCkb).toBeLessThanOrEqual(200);
  });

  it("returns invalid when total is below combined minimums", () => {
    const result = calculateDynamicSplit(50, 90, 10, 61, 61);
    expect(result.isValid).toBe(false);
    expect(result.invalidReason).toContain("61");
  });

  it("adjusts when platform would be below its minimum", () => {
    const result = calculateDynamicSplit(200, 99, 1, 61, 80);
    expect(result.isValid).toBe(true);
    expect(result.platformCkb).toBeGreaterThanOrEqual(80);
  });
});

describe("calculateReferralSplit", () => {
  it("splits evenly 50/50", () => {
    const result = calculateReferralSplit(200, 50, 50);
    expect(result.isValid).toBe(true);
    expect(result.referrerCkb).toBeCloseTo(result.platformCkb, 0);
  });

  it("adjusts referrer when platform below minimum", () => {
    const result = calculateReferralSplit(200, 99, 1, 63);
    expect(result.isValid).toBe(true);
    expect(result.wasAdjusted).toBe(true);
    expect(result.platformCkb).toBeGreaterThanOrEqual(63);
  });

  it("returns invalid below minimum total", () => {
    const result = calculateReferralSplit(100, 50, 50);
    expect(result.isValid).toBe(false);
  });
});

describe("shannonsToCkb / ckbToShannons", () => {
  it("converts 1 CKB correctly in both directions", () => {
    expect(shannonsToCkb(SHANNONS_PER_CKB)).toBe(1);
    expect(ckbToShannons(1)).toBe(SHANNONS_PER_CKB);
  });

  it("converts fractional CKB", () => {
    expect(shannonsToCkb(BigInt(50_000_000))).toBeCloseTo(0.5, 5);
  });

  it("round-trips 61.5 CKB", () => {
    const ckb = 61.5;
    expect(shannonsToCkb(ckbToShannons(ckb))).toBeCloseTo(ckb, 5);
  });

  it("SHANNONS_PER_CKB is 100_000_000n", () => {
    expect(SHANNONS_PER_CKB).toBe(100_000_000n);
  });
});
