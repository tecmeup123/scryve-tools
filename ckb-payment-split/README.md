# ckb-payment-split

A standalone TypeScript module for splitting CKB payments between multiple parties with **cell capacity awareness**. Designed for the Nervos CKB blockchain where every output cell must meet a minimum capacity requirement.

## The Problem

On Nervos CKB, every cell (UTXO) must hold enough CKB to cover its own storage cost. This minimum is determined by the cell's lock script size:

```
minimum_capacity = 8 (capacity field) + 32 (code_hash) + 1 (hash_type) + args_byte_length
```

When splitting a payment between two parties (e.g., a 90/10 tip split), the smaller share may fall below this minimum, making the transaction invalid. This module handles that automatically by detecting and rebalancing splits.

## Installation

```bash
npm install @ckb-ccc/core
```

Then copy `index.ts` into your project.

## Common Address Types & Minimum Capacities

| Address Type | Args Length | Minimum Capacity |
|---|---|---|
| Standard secp256k1 (ckb1qz...) | 20 bytes | **61 CKB** |
| OmniLock EVM-derived (ckb1qr...) | 22 bytes | **63 CKB** |
| OmniLock BTC-derived | 22 bytes | **63 CKB** |
| ACP (Anyone-Can-Pay) | 20 bytes | **61 CKB** |

The default minimum used by split functions is **63 CKB** (covers OmniLock addresses).

## API Reference

### Types

```typescript
type Network = "mainnet" | "testnet";

interface SplitResult {
  totalCkb: number;
  recipientCkb: number;
  platformCkb: number;
  originalRecipientPercent: number;
  originalPlatformPercent: number;
  adjustedRecipientPercent: number;
  adjustedPlatformPercent: number;
  wasAdjusted: boolean;
  isValid: boolean;
  invalidReason?: string;
}

interface ReferralSplitResult {
  totalCkb: number;
  referrerCkb: number;
  platformCkb: number;
  originalReferrerPercent: number;
  originalPlatformPercent: number;
  adjustedReferrerPercent: number;
  adjustedPlatformPercent: number;
  wasAdjusted: boolean;
  isValid: boolean;
  invalidReason?: string;
}
```

### Constants

```typescript
const DEFAULT_MIN_CELL_CAPACITY = 63;   // CKB (covers OmniLock addresses)
const SHANNONS_PER_CKB = 100_000_000n;  // 1 CKB = 10^8 shannons
```

### Cell Capacity Calculation

#### `calculateMinCellCapacity(address: string, network?: Network): Promise<number>`

Calculates the minimum cell capacity (in CKB) for a given address by parsing its lock script.

```typescript
import { calculateMinCellCapacity } from "./index";

const min = await calculateMinCellCapacity("ckt1qz...");
console.log(min); // 61 (standard secp256k1)

const minOmni = await calculateMinCellCapacity("ckt1qr...");
console.log(minOmni); // 63 (OmniLock)
```

Falls back to 61 CKB on error (safe default).

#### `calculateMinCapacityForAddresses(addresses: string[], network?: Network): Promise<{ address: string; minCapacity: number }[]>`

Batch calculation for multiple addresses.

```typescript
import { calculateMinCapacityForAddresses } from "./index";

const results = await calculateMinCapacityForAddresses([
  "ckt1qz...",
  "ckt1qr..."
]);
// [{ address: "ckt1qz...", minCapacity: 61 }, { address: "ckt1qr...", minCapacity: 63 }]
```

#### `calculateMinTotalForSplit(recipientAddress: string, platformAddress: string, network?: Network): Promise<{ recipientMin: number; platformMin: number; totalMin: number }>`

Calculates the total minimum CKB needed for a 2-party split.

```typescript
import { calculateMinTotalForSplit } from "./index";

const totals = await calculateMinTotalForSplit("ckt1qz...", "ckt1qr...");
// { recipientMin: 61, platformMin: 63, totalMin: 124 }
```

### Payment Split

#### `calculateSplit(totalCkb: number, recipientPercent: number, platformPercent: number, minCellCapacity?: number): SplitResult`

Splits a CKB amount between two parties, respecting minimum cell capacity.

```typescript
import { calculateSplit } from "./index";

// Normal split (no adjustment needed)
const result = calculateSplit(1000, 90, 10);
// { recipientCkb: 900, platformCkb: 100, wasAdjusted: false, isValid: true }

// Auto-rebalanced split (platform share too small)
const small = calculateSplit(200, 90, 10);
// platformCkb would be 20 (below 63), so it becomes:
// { recipientCkb: 137, platformCkb: 63, wasAdjusted: true, isValid: true }

// Invalid split (total too small for two cells)
const invalid = calculateSplit(100, 90, 10);
// { isValid: false, invalidReason: "Total amount (100.00 CKB) is below minimum..." }
```

#### `calculateDynamicSplit(totalCkb: number, recipientPercent: number, platformPercent: number, recipientMinCapacity: number, platformMinCapacity: number): SplitResult`

Same as `calculateSplit` but with per-address dynamic minimums. Use with `calculateMinCellCapacity` results.

```typescript
import { calculateDynamicSplit, calculateMinCellCapacity } from "./index";

const recipientMin = await calculateMinCellCapacity("ckt1qz...");  // 61
const platformMin = await calculateMinCellCapacity("ckt1qr...");   // 63

const result = calculateDynamicSplit(200, 90, 10, recipientMin, platformMin);
```

### Referral Split

#### `calculateReferralSplit(totalCkb: number, referrerPercent: number, platformPercent: number, minCellCapacity?: number): ReferralSplitResult`

Same split logic but named for referral context (referrer instead of recipient).

```typescript
import { calculateReferralSplit } from "./index";

const result = calculateReferralSplit(500, 50, 50);
// { referrerCkb: 250, platformCkb: 250, wasAdjusted: false, isValid: true }

const adjusted = calculateReferralSplit(140, 10, 90);
// referrerCkb would be 14 (below 63), so:
// { referrerCkb: 63, platformCkb: 77, wasAdjusted: true, isValid: true }
```

### Utilities

#### `isTestnetAddress(address: string): boolean`

Returns `true` if the address starts with `"ckt1"` (testnet prefix).

#### `getClient(network?: Network): CccClient`

Returns a CKB client instance for the specified network. Defaults to testnet.

#### `shannonsToCkb(shannons: bigint): number`

Converts shannons to CKB (1 CKB = 100,000,000 shannons).

```typescript
import { shannonsToCkb } from "./index";
shannonsToCkb(6_300_000_000n); // 63
```

#### `ckbToShannons(ckb: number): bigint`

Converts CKB to shannons.

```typescript
import { ckbToShannons } from "./index";
ckbToShannons(63); // 6_300_000_000n
```

## Auto-Rebalancing Behavior

When a split would produce an output below the minimum cell capacity:

1. The underfunded party is raised to exactly the minimum capacity
2. The other party receives the remainder (`total - minimum`)
3. `wasAdjusted` is set to `true` so the caller knows the original percentages were overridden
4. `adjustedRecipientPercent` / `adjustedPlatformPercent` reflect the actual split

If the total is below `2 * minCellCapacity` (or `recipientMin + platformMin` for dynamic splits), the split is invalid because neither party can receive a valid cell. The function returns `isValid: false` with an `invalidReason` string.

Split functions never throw errors. Invalid inputs produce `isValid: false` results.

## Full Usage Example

```typescript
import {
  calculateMinCellCapacity,
  calculateMinTotalForSplit,
  calculateDynamicSplit,
  calculateReferralSplit,
  shannonsToCkb,
  ckbToShannons,
  DEFAULT_MIN_CELL_CAPACITY,
} from "./index";

// 1. Check minimum capacities for your addresses
const recipientMin = await calculateMinCellCapacity(
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqflz5w7sethqzn7n2aqg4e25kc0r3q4kqn9t"
);
const platformMin = await calculateMinCellCapacity(
  "ckt1qrejnmlar3r452tcg57gvq8patctcgy8acync4hzh2qlkdtya0xwsqwyk5x9erg8furras980hksatlslfaktks7e6rn6"
);
console.log(`Recipient needs ${recipientMin} CKB, platform needs ${platformMin} CKB`);

// 2. Calculate a tip split with dynamic minimums
const tipAmount = 200; // CKB
const split = calculateDynamicSplit(tipAmount, 90, 10, recipientMin, platformMin);

if (split.isValid) {
  console.log(`Recipient gets ${split.recipientCkb} CKB (${split.adjustedRecipientPercent}%)`);
  console.log(`Platform gets ${split.platformCkb} CKB (${split.adjustedPlatformPercent}%)`);
  if (split.wasAdjusted) {
    console.log("Split was auto-rebalanced to meet minimum cell capacity");
  }

  // Convert to shannons for transaction building
  const recipientShannons = ckbToShannons(split.recipientCkb);
  const platformShannons = ckbToShannons(split.platformCkb);
} else {
  console.log(`Cannot split: ${split.invalidReason}`);
}

// 3. Handle a referral split
const referralSplit = calculateReferralSplit(500, 50, 50);
if (referralSplit.isValid) {
  console.log(`Referrer gets ${referralSplit.referrerCkb} CKB`);
  console.log(`Platform gets ${referralSplit.platformCkb} CKB`);
}
```

## Design Principles

- **No exceptions**: All functions return result objects with `isValid` flag instead of throwing
- **Pure functions**: Split calculations are pure (deterministic, no side effects). Only `calculateMinCellCapacity` and related functions are async (they query the CKB network)
- **2-decimal precision**: CKB amounts use `Math.floor(x * 100) / 100`; percentages use `Math.round(x * 100) / 100`
- **Safe defaults**: Falls back to 61 CKB minimum on address parsing errors; default minimum is 63 CKB (covers OmniLock)
- **Zero dependencies**: Only requires `@ckb-ccc/core` for CKB address parsing

## Acknowledgements

This module builds on the following third-party protocols and libraries:

- [CCC (`@ckb-ccc/core`)](https://github.com/ckb-ecofund/ccc) — CKB unified client library used by `calculateMinCellCapacity` to parse CKB addresses into lock scripts and compute their byte length. Provides `ccc.Address.fromString` and `ccc.ClientPublicTestnet` / `ccc.ClientPublicMainnet`.
- [OmniLock](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0042-omnilock/0042-omnilock.md) — Universal CKB lock script supporting Ethereum and Bitcoin identities. OmniLock's 22-byte args (vs. 20 bytes for standard secp256k1) is why the default minimum is **63 CKB** rather than 61 CKB.
- [Nervos CKB](https://nervos.org) — The underlying blockchain whose cell model defines minimum capacity rules. The formula `8 + 32 + 1 + args_length` bytes = minimum CKB is specified in the CKB cell model.

## Credits

Built and open-sourced by the [Scryve](https://scryve.xyz) team

## License

MIT
