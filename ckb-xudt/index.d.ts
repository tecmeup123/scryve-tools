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
 * CKB developer community
 */
import { ccc } from "@ckb-ccc/core";
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
        outPoint: {
            txHash: string;
            index: number;
        };
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
export declare const BEAF: XudtToken;
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
export declare function encodeXudtAmount(amount: bigint): Uint8Array;
/**
 * Decode a little-endian 16-byte xUDT cell data buffer back to a bigint.
 *
 * @example
 * decodeXudtAmount(new Uint8Array([0x80, 0x59, 0xfe, 0x02, ...]))
 * // 50_000_000n
 */
export declare function decodeXudtAmount(data: Uint8Array): bigint;
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
export declare function usdToXudt(usdAmount: number, priceUsd: number, decimals: number): number;
/**
 * Convert raw token units to USD.
 *
 * @param rawAmount  Raw token units (not decimal-scaled display amount)
 * @param priceUsd   Token price in USD per whole token
 * @param decimals   On-chain decimal places
 * @returns USD value
 */
export declare function xudtToUsd(rawAmount: number, priceUsd: number, decimals: number): number;
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
export declare function formatXudtAmount(amount: number, decimals: number, locale?: string): string;
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
 * @example
 * parseFormattedAmount("50,000,000")   // 50000000  (en-US comma thousands)
 * parseFormattedAmount("50.000.000")   // 50000000  (de-DE dot thousands)
 * parseFormattedAmount("50 000 000")   // 50000000  (fr-FR space thousands)
 * parseFormattedAmount("1.5")          // 1.5       (decimal point preserved)
 */
export declare function parseFormattedAmount(formatted: string): number;
/**
 * Convert a display (human-readable) token amount to raw on-chain units.
 *
 * For BEAF (decimals=0): `toRawUnits(50_000_000, 0)` → `50_000_000n`
 * For a 6-decimal token: `toRawUnits(1.5, 6)` → `1_500_000n`
 */
export declare function toRawUnits(displayAmount: number, decimals: number): bigint;
/**
 * Convert raw on-chain units to a display (human-readable) number.
 *
 * For BEAF (decimals=0): `toDisplayAmount(50_000_000n, 0)` → `50_000_000`
 * For a 6-decimal token: `toDisplayAmount(1_500_000n, 6)` → `1.5`
 */
export declare function toDisplayAmount(rawUnits: bigint, decimals: number): number;
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
export declare function fetchXudtPriceUsd(typeHash: string, apiKey: string): Promise<number>;
/**
 * Fetch full pool data for an xUDT token from UTXOSwap.
 *
 * Returns price plus the pool symbol and ID for downstream display or logging.
 *
 * @example
 * const pool = await fetchXudtPoolData(BEAF.typeHash, apiKey);
 * // { typeHash: "0xfbd2...", priceUsd: 1e-7, symbol: "BEAF", poolId: "..." }
 */
export declare function fetchXudtPoolData(typeHash: string, apiKey: string): Promise<XudtPoolData>;
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
export declare function sendXudtPayment(signer: ccc.Signer, token: XudtToken, recipient: XudtPaymentRecipient): Promise<XudtPaymentResult>;
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
export declare function sendXudtSplitPayment(signer: ccc.Signer, token: XudtToken, recipients: XudtPaymentRecipient[]): Promise<XudtPaymentResult>;
//# sourceMappingURL=index.d.ts.map