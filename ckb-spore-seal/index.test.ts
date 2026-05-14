import {
  encodeDna,
  decodeDna,
  encodeDnaToHex,
  validateDnaHex,
  createDnaData,
  createDnaDataWithTimestamp,
  createSealSigningMessageWithTimestamp,
  createClusterMetadata,
  createDOBContent,
  formatSealDate,
  formatCapacityAsCkb,
  estimateSealCapacity,
  STATUS_CODES,
  STATUS_FROM_CODE,
  STATUS_COLORS,
  STATUS_LABELS,
  DNA_TOTAL_BYTES,
  type ContentStatus,
} from "./index";

const STATUSES: ContentStatus[] = ["standard", "premium", "verified"];

describe("encodeDna / decodeDna round-trip", () => {
  it("round-trips standard status, not archived", () => {
    const data = createDnaDataWithTimestamp("0xabcd1234", 1, "standard", false, 1_700_000_000);
    const decoded = decodeDna(encodeDna(data));
    expect(decoded).not.toBeNull();
    expect(decoded!.contentId).toBe(1);
    expect(decoded!.status).toBe("standard");
    expect(decoded!.archived).toBe(false);
    expect(decoded!.timestamp).toBe(1_700_000_000);
  });

  it("round-trips premium status, archived", () => {
    const data = createDnaDataWithTimestamp("0xdeadbeef", 99, "premium", true, 1_600_000_000);
    const decoded = decodeDna(encodeDna(data));
    expect(decoded!.status).toBe("premium");
    expect(decoded!.archived).toBe(true);
    expect(decoded!.contentId).toBe(99);
  });

  it("round-trips verified status", () => {
    const data = createDnaDataWithTimestamp("0xcafebabe", 7, "verified", false, 0);
    const decoded = decodeDna(encodeDna(data));
    expect(decoded!.status).toBe("verified");
  });

  it("produces exactly DNA_TOTAL_BYTES bytes", () => {
    const data = createDnaData("0xabcdef", 1);
    expect(encodeDna(data)).toHaveLength(DNA_TOTAL_BYTES);
  });

  it("returns null for buffers shorter than DNA_TOTAL_BYTES", () => {
    expect(decodeDna(new Uint8Array(DNA_TOTAL_BYTES - 1))).toBeNull();
  });
});

describe("encodeDnaToHex / validateDnaHex", () => {
  it("encodes to hex without 0x prefix", () => {
    const data = createDnaData("0xabcdef", 1);
    const hex = encodeDnaToHex(data);
    expect(hex).toMatch(/^[0-9a-f]+$/);
    expect(hex.length).toBe(DNA_TOTAL_BYTES * 2);
  });

  it("validateDnaHex accepts plain hex", () => {
    const hex = encodeDnaToHex(createDnaData("0xabcdef", 1));
    expect(validateDnaHex(hex)).toBe(true);
  });

  it("validateDnaHex accepts 0x-prefixed hex", () => {
    const hex = "0x" + encodeDnaToHex(createDnaData("0xabcdef", 1));
    expect(validateDnaHex(hex)).toBe(true);
  });

  it("rejects hex of wrong length", () => {
    expect(validateDnaHex("0xdeadbeef")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    const bad = "z".repeat(DNA_TOTAL_BYTES * 2);
    expect(validateDnaHex(bad)).toBe(false);
  });
});

describe("STATUS_CODES / STATUS_FROM_CODE symmetry", () => {
  it("STATUS_FROM_CODE is the exact inverse of STATUS_CODES", () => {
    for (const s of STATUSES) {
      expect(STATUS_FROM_CODE[STATUS_CODES[s]]).toBe(s);
    }
  });

  it("all statuses have CSS color values", () => {
    for (const s of STATUSES) {
      expect(STATUS_COLORS[s]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("all statuses have human-readable labels", () => {
    for (const s of STATUSES) {
      expect(STATUS_LABELS[s].length).toBeGreaterThan(0);
    }
  });
});

describe("createDnaData", () => {
  it("sets correct status and archive flag", () => {
    const data = createDnaData("0xdeadbeef", 5, "verified", true);
    expect(data.status).toBe("verified");
    expect(data.archived).toBe(true);
    expect(data.contentId).toBe(5);
  });

  it("defaults to standard status and not archived", () => {
    const data = createDnaData("0xdeadbeef", 1);
    expect(data.status).toBe("standard");
    expect(data.archived).toBe(false);
  });
});

describe("formatSealDate", () => {
  it("formats a known unix timestamp to a readable date", () => {
    const result = formatSealDate(1_700_000_000); // Nov 14, 2023
    expect(result).toContain("2023");
    expect(result).toMatch(/Nov|14/);
  });
});

describe("formatCapacityAsCkb", () => {
  it("converts 1 CKB (100_000_000 shannons) correctly", () => {
    expect(formatCapacityAsCkb(100_000_000n)).toBe("1.00");
  });

  it("converts 61 CKB correctly", () => {
    expect(formatCapacityAsCkb(6_100_000_000n)).toBe("61.00");
  });
});

describe("estimateSealCapacity", () => {
  it("returns a bigint", () => {
    expect(typeof estimateSealCapacity()).toBe("bigint");
  });

  it("is at least 61 CKB (minimum lock script requirement)", () => {
    expect(estimateSealCapacity()).toBeGreaterThanOrEqual(61n * 100_000_000n);
  });
});

describe("createDOBContent", () => {
  it("wraps DNA hex under the dna key", () => {
    const data = createDnaData("0xabcdef", 5);
    const dob = createDOBContent(data);
    expect(typeof dob.dna).toBe("string");
    expect(validateDnaHex(dob.dna)).toBe(true);
  });
});

describe("createSealSigningMessageWithTimestamp", () => {
  it("contains content hash, content ID, and author address", () => {
    const msg = createSealSigningMessageWithTimestamp(
      "0xabc123",
      42,
      "ckb1qztest",
      1_700_000_000
    );
    expect(msg).toContain("0xabc123");
    expect(msg).toContain("42");
    expect(msg).toContain("ckb1qztest");
  });
});

describe("createClusterMetadata", () => {
  it("returns an object with description and dob.ver=0", () => {
    const meta = createClusterMetadata("My cluster");
    expect(meta.description).toBe("My cluster");
    expect(meta.dob.ver).toBe(0);
    expect(meta.dob.decoder.type).toBe("code_hash");
    expect(Array.isArray(meta.dob.pattern)).toBe(true);
  });
});
