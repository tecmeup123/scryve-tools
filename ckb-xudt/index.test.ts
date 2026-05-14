import {
  encodeXudtAmount,
  decodeXudtAmount,
  usdToXudt,
  xudtToUsd,
  formatXudtAmount,
  parseFormattedAmount,
  toRawUnits,
  toDisplayAmount,
  applySlippageBps,
  usdToXudtWithSlippage,
  BEAF,
} from "./index";

describe("encodeXudtAmount / decodeXudtAmount", () => {
  it("encodes zero as 16 zero bytes", () => {
    const buf = encodeXudtAmount(0n);
    expect(buf).toHaveLength(16);
    expect(Array.from(buf).every(b => b === 0)).toBe(true);
  });

  it("round-trips common BEAF amounts", () => {
    const amounts = [1n, 50_000_000n, 1_000_000_000n, BigInt(2 ** 32)];
    for (const amt of amounts) {
      expect(decodeXudtAmount(encodeXudtAmount(amt))).toBe(amt);
    }
  });

  it("encodes little-endian — LSB first", () => {
    const buf = encodeXudtAmount(1n);
    expect(buf[0]).toBe(1);
    expect(Array.from(buf.slice(1)).every(b => b === 0)).toBe(true);
  });

  it("throws for buffers shorter than 16 bytes", () => {
    expect(() => decodeXudtAmount(new Uint8Array(15))).toThrow();
  });

  it("throws for negative amounts", () => {
    expect(() => encodeXudtAmount(-1n)).toThrow();
  });
});

describe("usdToXudt / xudtToUsd", () => {
  it("converts $5 to 50M BEAF at $1e-7 per BEAF", () => {
    expect(usdToXudt(5, 1e-7, 0)).toBe(50_000_000);
  });

  it("returns 0 when price is zero", () => {
    expect(usdToXudt(5, 0, 0)).toBe(0);
  });

  it("converts raw BEAF back to USD", () => {
    expect(xudtToUsd(50_000_000, 1e-7, 0)).toBeCloseTo(5, 2);
  });

  it("handles a 6-decimal token round-trip", () => {
    const raw = usdToXudt(10, 0.5, 6);
    expect(raw).toBe(20_000_000);
    expect(xudtToUsd(raw, 0.5, 6)).toBeCloseTo(10, 5);
  });
});

describe("formatXudtAmount", () => {
  it("formats whole-token BEAF with locale thousands separators", () => {
    expect(formatXudtAmount(50_000_000, 0, "en-US")).toBe("50,000,000");
  });

  it("formats a 6-decimal token correctly", () => {
    expect(formatXudtAmount(1_500_000, 6, "en-US")).toBe("1.5");
  });

  it("rounds for decimals=0", () => {
    expect(formatXudtAmount(50_000_000.9, 0, "en-US")).toBe("50,000,001");
  });
});

describe("parseFormattedAmount — the production bug fix", () => {
  it("parses en-US comma thousands separator", () => {
    expect(parseFormattedAmount("50,000,000")).toBe(50_000_000);
  });

  it("does not strip dots — they are ambiguous with decimal points", () => {
    // "50.000.000" in de-DE means 50 million, but "1.5" in en-US means one-and-a-half.
    // Dots cannot be safely stripped without locale knowledge — parseFormattedAmount
    // deliberately strips only commas and spaces, not dots.
    // Consumers using de-DE formatted output should pass an explicit locale to
    // formatXudtAmount and strip the locale separator manually if needed.
    expect(parseFormattedAmount("50.000.000")).toBe(50); // ambiguous — not 50000000
  });

  it("parses de-DE dot thousands separator when locale is provided", () => {
    expect(parseFormattedAmount("50.000.000", "de-DE")).toBe(50_000_000);
  });

  it("parses fr-FR space thousands separator", () => {
    expect(parseFormattedAmount("50 000 000")).toBe(50_000_000);
  });

  it("preserves the decimal point", () => {
    expect(parseFormattedAmount("1.5")).toBe(1.5);
  });

  it("returns 0 for empty string", () => {
    expect(parseFormattedAmount("")).toBe(0);
  });

  it("demonstrates the bug and the fix — real production values", () => {
    const formatted = formatXudtAmount(51_918_060, 0, "en-US");
    expect(formatted).toBe("51,918,060");
    expect(parseFloat(formatted)).toBe(51);           // the bug: stops at comma
    expect(parseFormattedAmount(formatted)).toBe(51_918_060); // the fix
  });
});

describe("toRawUnits / toDisplayAmount", () => {
  it("BEAF: no scaling (decimals=0)", () => {
    expect(toRawUnits(50_000_000, 0)).toBe(50_000_000n);
    expect(toDisplayAmount(50_000_000n, 0)).toBe(50_000_000);
  });

  it("6-decimal token: scales correctly", () => {
    expect(toRawUnits(1.5, 6)).toBe(1_500_000n);
    expect(toDisplayAmount(1_500_000n, 6)).toBe(1.5);
  });
});

describe("applySlippageBps / usdToXudtWithSlippage", () => {
  it("applySlippageBps returns the original price for 0 bps", () => {
    expect(applySlippageBps(1e-7, 0)).toBe(1e-7);
  });
  it("applySlippageBps inflates price by 1% for 100 bps", () => {
    expect(applySlippageBps(1.0, 100)).toBeCloseTo(1.01, 10);
  });
  it("applySlippageBps throws for negative bps", () => {
    expect(() => applySlippageBps(1.0, -1)).toThrow();
  });
  it("usdToXudtWithSlippage returns fewer tokens than without slippage", () => {
    const price = 1e-7;
    const noSlippage = usdToXudt(5, price, 0);
    const withSlippage = usdToXudtWithSlippage(5, price, 0, 100);
    expect(withSlippage).toBeLessThan(noSlippage);
  });
  it("usdToXudtWithSlippage with 0 bps matches usdToXudt", () => {
    expect(usdToXudtWithSlippage(5, 1e-7, 0, 0)).toBe(usdToXudt(5, 1e-7, 0));
  });
});

describe("BEAF constant", () => {
  it("has decimals=0", () => {
    expect(BEAF.decimals).toBe(0);
  });

  it("has the correct mainnet type hash", () => {
    expect(BEAF.typeHash).toBe(
      "0xfbd235ba8e5b1f8f7df6bd51e8756d52c05ef358d30e7bcfee8a73b6a9c185c9"
    );
  });

  it("has hashType data1", () => {
    expect(BEAF.typeScript.hashType).toBe("data1");
  });

  it("has a UTXOSwap swap URL", () => {
    expect(BEAF.swapUrl).toContain("utxoswap.xyz");
  });
});
