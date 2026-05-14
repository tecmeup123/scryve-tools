/**
 * @scryve-tools/ckb-xudt
 *
 * xUDT / RGB++ token payments on CKB.
 *
 * Three fully independent sections:
 *  1. Amount utilities  — pure functions, zero dependencies
 *  2. UTXOSwap oracle   — live token prices via native fetch, zero npm deps
 *  3. Payment functions — send / split xUDT payments (requires @ckb-ccc/core)
 *
 * Built from Scryve's production BEAF integration and open-sourced for the
 * CKB developer community.
 */

import { ccc } from "@ckb-ccc/core";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Network = "mainnet" | "testnet";

/**
 * Metadata for an xUDT token deployed on CKB.
 * `cellDep` is optional — CCC resolves type script deps automatically via
 * `completeInputsByUdt`. Supply it to override or when building txs manually.
 */
export interface XudtToken {
  symbol: string;
  name: string;
  /** On-chain decimal places. BEAF is 0 (1 raw unit = 1 whole token). */
  decimals: number;
  typeScript: {
    codeHash: string;
    hashType: "data" | "data1" | "type";
    args: string;
  };
  /** Hex type hash of the type script — used as the pool search key on UTXOSwap. */
  typeHash: string;
  cellDep?: {
    outPoint: { txHash: string; index: number };
    depType: "code" | "depGroup";
  };
  /** Optional logo URL for display purposes. */
  logoUrl?: string;
  /** UTXOSwap swap URL for this token (swap CKB → token). */
  swapUrl?: string;
}

/** One recipient in a split or single payment. `amount` is in raw token units. */
export interface XudtPaymentRecipient {
  address: string;
  /** Raw token units (no decimal scaling). Use `toRawUnits()` to convert from display amounts. */
  amount: bigint;
}

export interface XudtPaymentResult {
  txHash: string;
}

/** Data returned by the UTXOSwap pool price oracle. */
export interface XudtPoolData {
  typeHash: string;
  priceUsd: number;
  symbol: string;
  poolId?: string;
}

interface UTXOSwapAsset {
  price?: string;
  symbol?: string;
}

interface UTXOSwapPool {
  id?: string;
  assetY?: UTXOSwapAsset;
}

interface UTXOSwapApiResponse {
  data?: {
    list?: UTXOSwapPool[];
  };
}

// ─── Built-in Token: BEAF ─────────────────────────────────────────────────────

/**
 * BEAF token — production-verified mainnet xUDT on CKB.
 *
 * Key characteristics:
 * - `decimals: 0` — 1 raw unit = 1 whole BEAF token (no scaling)
 * - Price is fetched from UTXOSwap (~$1e-7 USD/BEAF at time of publication)
 * - $5 USD ≈ 50,000,000 BEAF
 *
 * Type script values verified via UTXOSwap pool API.
 */
export const BEAF: XudtToken = {
  symbol: "BEAF",
  name: "BEAF",
  decimals: 0,
  typeScript: {
    codeHash: "0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95",
    hashType: "data1",
    args: "0xc639759e988445217e4c08b2e7b416082d9de0cb061194e2f7f35a89bb6fbf4f",
  },
  typeHash: "0xfbd235ba8e5b1f8f7df6bd51e8756d52c05ef358d30e7bcfee8a73b6a9c185c9",
  logoUrl: "https://xudtlogos.cc/logos/beaf-logo.png",
  swapUrl:
    "https://utxoswap.xyz/swap/CKB/0xfbd235ba8e5b1f8f7df6bd51e8756d52c05ef358d30e7bcfee8a73b6a9c185c9",
};

// ─── Amount Utilities (pure, zero dependencies) ───────────────────────────────

/**
 * Encode a token amount as a little-endian 16-byte Uint8Array for use in
 * CKB transaction `outputsData`. This is the standard xUDT cell data format
 * (see xUDT RFC #0052).
 *
 * Equivalent to CCC's `ccc.numLeToBytes(amount, 16)`.
 *
 * @example
 * encodeXudtAmount(50_000_000n)
 * // Uint8Array(16) [0x80, 0x59, 0xfe, 0x02, 0x00, ...]
 */
export function encodeXudtAmount(amount: bigint): Uint8Array {
  if (amount < 0n) {
    throw new Error(`encodeXudtAmount: amount must be non-negative, got ${amount}`);
  }
  const buf = new Uint8Array(16);
  let n = amount;
  for (let i = 0; i < 16; i++) {
    buf[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buf;
}

/**
 * Decode a little-endian 16-byte xUDT cell data buffer back to a bigint.
 *
 * @example
 * decodeXudtAmount(new Uint8Array([0x80, 0x59, 0xfe, 0x02, ...]))
 * // 50_000_000n
 */
export function decodeXudtAmount(data: Uint8Array): bigint {
  if (data.length < 16) {
    throw new Error(`decodeXudtAmount: expected at least 16 bytes, got ${data.length}`);
  }
  let result = 0n;
  for (let i = 15; i >= 0; i--) {
    result = (result << 8n) | BigInt(data[i]);
  }
  return result;
}

/**
 * Convert a USD amount to raw token units.
 *
 * Formula: `floor( usdAmount / priceUsd / 10^decimals )`
 *
 * For BEAF (decimals=0): `usdToXudt(5, 1e-7, 0)` → `50_000_000`
 *
 * @param usdAmount  Amount in USD
 * @param priceUsd   Token price in USD per whole token
 * @param decimals   On-chain decimal places (0 for BEAF)
 * @returns Number of raw token units
 */
export function usdToXudt(usdAmount: number, priceUsd: number, decimals: number): number {
  if (priceUsd <= 0) return 0;
  const wholeTokens = usdAmount / priceUsd;
  return Math.floor(wholeTokens * Math.pow(10, decimals));
}

/**
 * Convert raw token units to USD.
 *
 * @param rawAmount  Raw token units (not decimal-scaled display amount)
 * @param priceUsd   Token price in USD per whole token
 * @param decimals   On-chain decimal places
 * @returns USD value
 */
export function xudtToUsd(rawAmount: number, priceUsd: number, decimals: number): number {
  if (priceUsd <= 0) return 0;
  const wholeTokens = rawAmount / Math.pow(10, decimals);
  return wholeTokens * priceUsd;
}

/**
 * Format a raw token amount for display.
 *
 * When `decimals === 0`, uses `Math.round` + `toLocaleString` with no decimal
 * places (correct for BEAF). Otherwise respects the token's decimal places.
 *
 * @warning Output is locale-formatted and cannot be safely passed to `parseFloat()`.
 *          Use `parseFormattedAmount()` to convert a display string back to a number.
 *
 * @example
 * formatXudtAmount(50_000_000, 0)          // "50,000,000"
 * formatXudtAmount(1_500_000, 6)           // "1.5"
 * formatXudtAmount(50_000_000, 0, "de-DE") // "50.000.000"
 */
export function formatXudtAmount(amount: number, decimals: number, locale?: string): string {
  if (decimals === 0) {
    return Math.round(amount).toLocaleString(locale);
  }
  const displayAmount = amount / Math.pow(10, decimals);
  return displayAmount.toLocaleString(locale, { maximumFractionDigits: decimals });
}

/**
 * Parse a locale-formatted xUDT display string back to a plain number.
 *
 * `formatXudtAmount` uses `toLocaleString()` which adds locale-specific thousands
 * separators (commas in en-US, dots in de-DE, spaces in fr-FR). Passing such a
 * string to `parseFloat()` silently truncates at the first separator:
 * `parseFloat("50,000,000")` returns `50`, not `50000000`.
 *
 * This function strips all locale separators while preserving the decimal point,
 * then parses the result. It is the safe inverse of `formatXudtAmount`.
 *
 * @param locale  Optional BCP 47 locale tag (e.g. "de-DE") for locale-aware separator stripping.
 *                When provided, uses Intl.NumberFormat to detect the thousands separator and
 *                decimal character for that locale.
 *
 * @example
 * parseFormattedAmount("50,000,000")   // 50000000  (en-US comma thousands)
 * parseFormattedAmount("50.000.000")   // 50000000  (de-DE dot thousands)
 * parseFormattedAmount("50 000 000")   // 50000000  (fr-FR space thousands)
 * parseFormattedAmount("1.5")          // 1.5       (decimal point preserved)
 */
export function parseFormattedAmount(formatted: string, locale?: string): number {
  if (locale) {
    const parts = new Intl.NumberFormat(locale).formatToParts(1234567.89);
    const group = parts.find(p => p.type === "group")?.value ?? ",";
    const decimal = parts.find(p => p.type === "decimal")?.value ?? ".";
    const stripped = formatted.split(group).join("");
    const normalized = decimal !== "." ? stripped.replace(decimal, ".") : stripped;
    return parseFloat(normalized) || 0;
  }
  const cleaned = formatted.replace(/[,\s]/g, "");
  return parseFloat(cleaned) || 0;
}

/**
 * Convert a display (human-readable) token amount to raw on-chain units.
 *
 * For BEAF (decimals=0): `toRawUnits(50_000_000, 0)` → `50_000_000n`
 * For a 6-decimal token: `toRawUnits(1.5, 6)` → `1_500_000n`
 */
export function toRawUnits(displayAmount: number, decimals: number): bigint {
  return BigInt(Math.round(displayAmount * Math.pow(10, decimals)));
}

/**
 * Convert raw on-chain units to a display (human-readable) number.
 *
 * For BEAF (decimals=0): `toDisplayAmount(50_000_000n, 0)` → `50_000_000`
 * For a 6-decimal token: `toDisplayAmount(1_500_000n, 6)` → `1.5`
 */
export function toDisplayAmount(rawUnits: bigint, decimals: number): number {
  return Number(rawUnits) / Math.pow(10, decimals);
}

/**
 * Apply a slippage buffer to a USD price by inflating it by `bps` basis points.
 * Pass the result to `usdToXudt()` to get a conservative (fewer tokens per dollar)
 * amount that still makes sense even if the oracle price is slightly stale.
 *
 * @param priceUsd   Current oracle price in USD per whole token
 * @param bps        Basis points of slippage tolerance (100 bps = 1%)
 * @returns Adjusted price with slippage applied
 *
 * @example
 * const price = await fetchXudtPriceUsd(BEAF.typeHash, apiKey);
 * const conservativePrice = applySlippageBps(price, 50); // +0.5%
 * const rawAmount = toRawUnits(usdToXudt(5, conservativePrice, BEAF.decimals), BEAF.decimals);
 */
export function applySlippageBps(priceUsd: number, bps: number): number {
  if (bps < 0) throw new Error("applySlippageBps: bps must be non-negative");
  return priceUsd * (1 + bps / 10_000);
}

/**
 * Compute the conservative raw token amount for a USD spend, with slippage protection.
 *
 * Inflates the oracle price by `slippageBps` basis points before computing the amount,
 * so you send slightly fewer tokens — protecting against price movement between
 * oracle fetch and transaction submission.
 *
 * @param usdAmount    Amount in USD to spend
 * @param priceUsd     Current oracle price in USD per whole token
 * @param decimals     Token's on-chain decimal places
 * @param slippageBps  Basis points of slippage tolerance (e.g. 50 = 0.5%)
 * @returns Raw token units adjusted for slippage
 *
 * @example
 * const price = await fetchXudtPriceUsd(BEAF.typeHash, apiKey);
 * const rawAmount = usdToXudtWithSlippage(5, price, BEAF.decimals, 50);
 */
export function usdToXudtWithSlippage(
  usdAmount: number,
  priceUsd: number,
  decimals: number,
  slippageBps: number,
): number {
  return usdToXudt(usdAmount, applySlippageBps(priceUsd, slippageBps), decimals);
}

// ─── UTXOSwap Price Oracle (no npm deps, native fetch) ────────────────────────

const UTXOSWAP_POOLS_URL = "https://utxoswap.xyz/utxo-swap/api/v1/sequencer/pools";

/**
 * Fetch the current USD price of an xUDT token from the UTXOSwap pool API.
 *
 * UTXOSwap is the primary decentralised exchange for xUDT tokens on CKB.
 * This is the first published TypeScript client for its pool price API.
 *
 * @param typeHash  Hex type hash of the xUDT token (e.g. `BEAF.typeHash`)
 * @param apiKey    Your UTXOSwap API key (available at utxoswap.xyz)
 * @returns USD price per whole token, or 0 if the pool is not found
 *
 * @example
 * const price = await fetchXudtPriceUsd(BEAF.typeHash, process.env.UTXOSWAP_API_KEY!);
 * console.log(`BEAF: $${price}`); // "BEAF: $0.0000001"
 */
export async function fetchXudtPriceUsd(typeHash: string, apiKey: string): Promise<number> {
  const response = await fetch(UTXOSWAP_POOLS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ pageNo: 0, pageSize: 1, searchKey: typeHash }),
  });

  if (!response.ok) {
    throw new Error(
      `UTXOSwap API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json() as UTXOSwapApiResponse;
  const rawPrice: string = data?.data?.list?.[0]?.assetY?.price ?? "0";
  return parseFloat(rawPrice);
}

/**
 * Fetch full pool data for an xUDT token from UTXOSwap.
 *
 * Returns price plus the pool symbol and ID for downstream display or logging.
 *
 * @example
 * const pool = await fetchXudtPoolData(BEAF.typeHash, apiKey);
 * // { typeHash: "0xfbd2...", priceUsd: 1e-7, symbol: "BEAF", poolId: "..." }
 */
export async function fetchXudtPoolData(
  typeHash: string,
  apiKey: string,
): Promise<XudtPoolData> {
  const response = await fetch(UTXOSWAP_POOLS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ pageNo: 0, pageSize: 1, searchKey: typeHash }),
  });

  if (!response.ok) {
    throw new Error(
      `UTXOSwap API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json() as UTXOSwapApiResponse;
  const pool = data?.data?.list?.[0];

  if (!pool) {
    return { typeHash, priceUsd: 0, symbol: "" };
  }

  return {
    typeHash,
    priceUsd: parseFloat(pool?.assetY?.price ?? "0"),
    symbol: pool?.assetY?.symbol ?? "",
    poolId: pool?.id ?? undefined,
  };
}

// ─── Payment Functions (requires @ckb-ccc/core) ───────────────────────────────

/**
 * Send an xUDT token payment to a single recipient on CKB.
 *
 * Uses CCC's `completeInputsByUdt` which automatically resolves the type
 * script's cell dep from the chain — no manual cell dep lookup needed for
 * standard xUDT deployments. Supply `token.cellDep` to override.
 *
 * @param signer     A connected `ccc.Signer` instance (CKB wallet)
 * @param token      The xUDT token to send (use `BEAF` or define your own)
 * @param recipient  Recipient address and raw token amount (bigint)
 * @returns `{ txHash }` of the submitted CKB transaction
 *
 * @example
 * const rawAmount = toRawUnits(50_000_000, BEAF.decimals); // 50_000_000n
 * const { txHash } = await sendXudtPayment(signer, BEAF, {
 *   address: "ckb1qz...",
 *   amount: rawAmount,
 * });
 */
export async function sendXudtPayment(
  signer: ccc.Signer,
  token: XudtToken,
  recipient: XudtPaymentRecipient,
): Promise<XudtPaymentResult> {
  const typeScript = ccc.Script.from(token.typeScript);
  const recipientLock = (
    await ccc.Address.fromString(recipient.address, signer.client)
  ).script;

  const tx = ccc.Transaction.from({
    outputs: [{ lock: recipientLock, type: typeScript }],
    outputsData: [encodeXudtAmount(recipient.amount)],
  });

  if (token.cellDep) {
    tx.addCellDeps(ccc.CellDep.from(token.cellDep));
  }

  await tx.completeInputsByUdt(signer, typeScript);
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);

  const txHash = await signer.sendTransaction(tx);
  return { txHash };
}

/**
 * Send an xUDT token payment split between multiple recipients in a single
 * CKB transaction.
 *
 * All recipients are funded in one atomic transaction — either all succeed or
 * none do. This is more efficient than sequential single payments and avoids
 * double-spend race conditions.
 *
 * Common use case: tip split between author (90%) and platform (10%).
 *
 * @param signer      A connected `ccc.Signer` instance (CKB wallet)
 * @param token       The xUDT token to send
 * @param recipients  Array of { address, amount } — amounts in raw token units
 * @returns `{ txHash }` of the submitted CKB transaction
 *
 * @example
 * const authorAmount = toRawUnits(45_000_000, BEAF.decimals);
 * const platformAmount = toRawUnits(5_000_000, BEAF.decimals);
 *
 * const { txHash } = await sendXudtSplitPayment(signer, BEAF, [
 *   { address: "ckb1qz...", amount: authorAmount },    // author 90%
 *   { address: "ckb1qr...", amount: platformAmount },  // platform 10%
 * ]);
 */
export async function sendXudtSplitPayment(
  signer: ccc.Signer,
  token: XudtToken,
  recipients: XudtPaymentRecipient[],
): Promise<XudtPaymentResult> {
  if (recipients.length === 0) {
    throw new Error("sendXudtSplitPayment: recipients array must not be empty");
  }

  const typeScript = ccc.Script.from(token.typeScript);

  const outputs = await Promise.all(
    recipients.map(async (r) => ({
      lock: (await ccc.Address.fromString(r.address, signer.client)).script,
      type: typeScript,
    }))
  );

  const outputsData = recipients.map((r) => encodeXudtAmount(r.amount));

  const tx = ccc.Transaction.from({ outputs, outputsData });

  if (token.cellDep) {
    tx.addCellDeps(ccc.CellDep.from(token.cellDep));
  }

  await tx.completeInputsByUdt(signer, typeScript);
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);

  const txHash = await signer.sendTransaction(tx);
  return { txHash };
}
