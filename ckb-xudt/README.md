# ckb-xudt

A standalone TypeScript module for **xUDT / RGB++ token payments on CKB**. Covers three independent concerns:

1. **Amount utilities** — little-endian 16-byte encoding/decoding, USD↔token conversion, display formatting. Zero dependencies.
2. **UTXOSwap price oracle** — fetch live USD prices for any xUDT token from UTXOSwap's pool API. Zero npm dependencies (native `fetch`).
3. **Payment functions** — send or split xUDT payments in a single CKB transaction (requires `@ckb-ccc/core`).

Includes a built-in `BEAF` token constant (production-verified mainnet values).

## The Problem

Working with xUDT tokens on CKB involves three non-obvious challenges:

**1. Cell data encoding.** xUDT token amounts in CKB cell `outputsData` are stored as 128-bit **little-endian** unsigned integers. This is easy to get wrong and silently produces broken transactions.

```ts
// Wrong — BigInt serialised as big-endian
outputsData: ["0x" + amount.toString(16).padStart(32, "0")]

// Correct — little-endian 16-byte
outputsData: [encodeXudtAmount(50_000_000n)]
```

**2. No standard price oracle.** Unlike EVM chains, CKB has no on-chain price oracle for xUDT tokens. UTXOSwap's pool API is the primary real-time source, but there was no published TypeScript client for it.

**3. Correct type script + cell dep.** Each xUDT token has a unique type script (codeHash + args) and an associated cell dep. Looking these up from first principles takes time — this module ships the production-verified BEAF values.

## Installation

### With payment functions (full install)

```bash
npm install @scryve-tools/ckb-xudt @ckb-ccc/core
```

```ts
import {
  BEAF,
  sendXudtPayment,
  sendXudtSplitPayment,
  fetchXudtPriceUsd,
  toRawUnits,
  formatXudtAmount,
} from "@scryve-tools/ckb-xudt";
```

### Oracle and utilities only (no npm deps)

Copy `index.ts` into your project. Import only the functions you need — the payment functions are tree-shakeable and will not execute without `@ckb-ccc/core` installed.

## Token Registry

### `XudtToken` interface

```ts
interface XudtToken {
  symbol: string;
  name: string;
  decimals: number;         // on-chain decimal places
  typeScript: {
    codeHash: string;
    hashType: "data" | "data1" | "type";
    args: string;
  };
  typeHash: string;         // used as pool search key on UTXOSwap
  cellDep?: {               // optional — CCC resolves automatically
    outPoint: { txHash: string; index: number };
    depType: "code" | "depGroup";
  };
  logoUrl?: string;
  swapUrl?: string;         // UTXOSwap swap URL for this token
}
```

### Built-in: `BEAF`

BEAF is an RGB++ xUDT token on CKB. Its key characteristic is `decimals: 0` — one raw on-chain unit is one whole BEAF token. There is no decimal scaling.

```ts
import { BEAF } from "@scryve-tools/ckb-xudt";

console.log(BEAF.typeHash);
// "0xfbd235ba8e5b1f8f7df6bd51e8756d52c05ef358d30e7bcfee8a73b6a9c185c9"

console.log(BEAF.swapUrl);
// "https://utxoswap.xyz/swap/CKB/0xfbd235ba8e5b1f8f7df6bd51e8756d52c05ef358d30e7bcfee8a73b6a9c185c9"
```

All values are production-verified against the UTXOSwap pool API and live CKB mainnet transactions.

### Defining your own token

```ts
import type { XudtToken } from "@scryve-tools/ckb-xudt";

const MY_TOKEN: XudtToken = {
  symbol: "MYTOKEN",
  name: "My Token",
  decimals: 8,
  typeScript: {
    codeHash: "0x...",
    hashType: "data1",
    args: "0x...",
  },
  typeHash: "0x...",
};
```

## Amount Utilities

All utilities are pure functions with no side effects and zero dependencies.

### `encodeXudtAmount(amount: bigint): Uint8Array`

Encode a token amount as a little-endian 16-byte Uint8Array for use in CKB transaction `outputsData`. This is the standard format defined in xUDT RFC #0052.

```ts
import { encodeXudtAmount } from "@scryve-tools/ckb-xudt";

const data = encodeXudtAmount(50_000_000n);
// Uint8Array(16) — ready to use as outputsData in a CKB transaction
```

### `decodeXudtAmount(data: Uint8Array): bigint`

Read a little-endian 16-byte xUDT cell data buffer back to a bigint.

```ts
import { decodeXudtAmount } from "@scryve-tools/ckb-xudt";

const cell = await rpc.getLiveCell(outPoint, true);
const amount = decodeXudtAmount(new Uint8Array(Buffer.from(cell.data.content.slice(2), "hex")));
console.log(amount); // 50_000_000n
```

### `toRawUnits(displayAmount: number, decimals: number): bigint`

Convert a human-readable display amount to raw on-chain units.

```ts
import { toRawUnits, BEAF } from "@scryve-tools/ckb-xudt";

// BEAF: decimals = 0, no scaling
toRawUnits(50_000_000, BEAF.decimals)  // → 50_000_000n

// A hypothetical 6-decimal token
toRawUnits(1.5, 6)                     // → 1_500_000n
```

### `toDisplayAmount(rawUnits: bigint, decimals: number): number`

Convert raw on-chain units back to a display number.

```ts
import { toDisplayAmount, BEAF } from "@scryve-tools/ckb-xudt";

toDisplayAmount(50_000_000n, BEAF.decimals)  // → 50_000_000
toDisplayAmount(1_500_000n, 6)               // → 1.5
```

### `usdToXudt(usdAmount, priceUsd, decimals): number`

Convert a USD amount to raw token units using a live price.

```ts
import { usdToXudt, BEAF } from "@scryve-tools/ckb-xudt";

// $5 worth of BEAF at $1e-7 per BEAF
usdToXudt(5, 1e-7, BEAF.decimals)  // → 50_000_000

// $10 of a 6-decimal token at $0.50 each
usdToXudt(10, 0.50, 6)             // → 20_000_000
```

### `xudtToUsd(rawAmount, priceUsd, decimals): number`

Convert raw token units to a USD value.

```ts
import { xudtToUsd, BEAF } from "@scryve-tools/ckb-xudt";

xudtToUsd(50_000_000, 1e-7, BEAF.decimals)  // → 5.0
```

### `formatXudtAmount(amount, decimals, locale?): string`

Format a raw token amount for display. For `decimals === 0` (e.g. BEAF), applies `Math.round` and locale-aware thousands separators with no decimal places.

```ts
import { formatXudtAmount, BEAF } from "@scryve-tools/ckb-xudt";

formatXudtAmount(50_000_000, BEAF.decimals)           // "50,000,000"
formatXudtAmount(50_000_000, BEAF.decimals, "de-DE")  // "50.000.000"
formatXudtAmount(1_500_000, 6)                        // "1.5"
```

> **Pitfall:** Never pass `formatXudtAmount` output to `parseFloat()` directly.
> `parseFloat("50,000,000")` returns `50`, not `50000000` — it stops at the first comma.
> Use `parseFormattedAmount()` to safely parse display strings back to numbers,
> or operate on raw `bigint` amounts for all balance comparisons.

### `parseFormattedAmount(formatted: string): number`

Parse a locale-formatted display string back to a plain number. This is the safe inverse of `formatXudtAmount`.

`toLocaleString()` adds locale-specific thousands separators (commas in en-US, dots in de-DE, spaces in fr-FR). Passing such a string to `parseFloat()` silently truncates at the first separator. This function strips all separators while preserving the decimal point.

```ts
import { parseFormattedAmount } from "@scryve-tools/ckb-xudt";

parseFormattedAmount("50,000,000")   // 50000000  — en-US comma thousands
parseFormattedAmount("50.000.000")   // 50000000  — de-DE dot thousands
parseFormattedAmount("50 000 000")   // 50000000  — fr-FR space thousands
parseFormattedAmount("1.5")          // 1.5       — decimal point preserved
```

Typical use: comparing a formatted wallet balance against a required payment amount.

```ts
const formatted = formatXudtAmount(userRawBalance, BEAF.decimals); // "51,918,060"
const numeric = parseFormattedAmount(formatted);                    // 51918060

if (numeric < requiredAmount) {
  // show "Insufficient balance"
}
```

## UTXOSwap Price Oracle

UTXOSwap is the primary decentralised exchange for xUDT tokens on CKB. This module provides the first published TypeScript client for its pool price API.

**Requires:** An API key from [utxoswap.xyz](https://utxoswap.xyz). Store it server-side (never expose in client code).

### `fetchXudtPriceUsd(typeHash, apiKey): Promise<number>`

Fetch the current USD price of any xUDT token by its type hash.

```ts
import { fetchXudtPriceUsd, BEAF } from "@scryve-tools/ckb-xudt";

const price = await fetchXudtPriceUsd(BEAF.typeHash, process.env.UTXOSWAP_API_KEY!);
console.log(`BEAF: $${price}`);  // "BEAF: $0.0000001"
```

Returns `0` if the token has no pool on UTXOSwap. Throws on HTTP errors.

### `fetchXudtPoolData(typeHash, apiKey): Promise<XudtPoolData>`

Fetch the full pool record including symbol and pool ID.

```ts
import { fetchXudtPoolData, BEAF } from "@scryve-tools/ckb-xudt";

const pool = await fetchXudtPoolData(BEAF.typeHash, process.env.UTXOSWAP_API_KEY!);
// {
//   typeHash: "0xfbd235ba8e5b1f8f7df6bd51e8756d52c05ef358d30e7bcfee8a73b6a9c185c9",
//   priceUsd: 1e-7,
//   symbol: "BEAF",
//   poolId: "..."
// }
```

### UTXOSwap API details

```
POST https://utxoswap.xyz/utxo-swap/api/v1/sequencer/pools
Headers: { "x-api-key": "<your-key>", "Content-Type": "application/json" }
Body:    { "pageNo": 0, "pageSize": 1, "searchKey": "<typeHash>" }
```

The price is in `data.list[0].assetY.price` as a decimal string.

## Payment Functions

Requires `@ckb-ccc/core` and a connected `ccc.Signer`.

CCC's `completeInputsByUdt` automatically resolves the xUDT type script's cell dep from the chain — you do not need to look up or hardcode cell dep values for standard xUDT deployments. Supply `token.cellDep` only if you need to override the resolved dep.

### `sendXudtPayment(signer, token, recipient): Promise<XudtPaymentResult>`

Send tokens to a single recipient.

```ts
import { sendXudtPayment, BEAF, toRawUnits } from "@scryve-tools/ckb-xudt";
import { ccc } from "@ckb-ccc/connector-react";

// Inside a React component with a connected CCC signer:
const { wallet } = ccc.useCcc();

const rawAmount = toRawUnits(50_000_000, BEAF.decimals); // 50_000_000n

const { txHash } = await sendXudtPayment(wallet.signer, BEAF, {
  address: "ckb1qz...",
  amount: rawAmount,
});

console.log(`Sent! https://explorer.nervos.org/transaction/${txHash}`);
```

### `sendXudtSplitPayment(signer, token, recipients): Promise<XudtPaymentResult>`

Split a token payment between multiple recipients in a single atomic CKB transaction.

All recipients are funded together — either all succeed or none do. More efficient than sequential single payments for tip splits.

```ts
import { sendXudtSplitPayment, BEAF, toRawUnits } from "@scryve-tools/ckb-xudt";

const total = 50_000_000;  // raw BEAF units

const { txHash } = await sendXudtSplitPayment(wallet.signer, BEAF, [
  { address: "ckb1qz...", amount: toRawUnits(total * 0.9, BEAF.decimals) },  // author 90%
  { address: "ckb1qr...", amount: toRawUnits(total * 0.1, BEAF.decimals) },  // platform 10%
]);
```

## Full Usage Example

End-to-end: fetch a live price, calculate the token amount, and send a $5 tip.

```ts
import {
  BEAF,
  fetchXudtPriceUsd,
  usdToXudt,
  toRawUnits,
  formatXudtAmount,
  sendXudtPayment,
} from "@scryve-tools/ckb-xudt";

async function sendFiveDollarTip(signer: ccc.Signer, authorAddress: string) {
  // 1. Fetch current BEAF price from UTXOSwap
  const priceUsd = await fetchXudtPriceUsd(BEAF.typeHash, process.env.UTXOSWAP_API_KEY!);

  // 2. Convert $5 to raw BEAF units
  const rawBeaf = usdToXudt(5, priceUsd, BEAF.decimals);
  console.log(`Sending ${formatXudtAmount(rawBeaf, BEAF.decimals)} BEAF`);
  // "Sending 50,000,000 BEAF" (at $1e-7/BEAF)

  // 3. Send the payment
  const { txHash } = await sendXudtPayment(signer, BEAF, {
    address: authorAddress,
    amount: toRawUnits(rawBeaf, BEAF.decimals),
  });

  return txHash;
}
```

## Design Principles

- **Pure utils, never throw.** Amount utilities return `0` or an empty buffer for degenerate inputs rather than throwing. Only payment functions and the oracle throw — callers must handle those errors.
- **Bigint for amounts.** On-chain amounts use `bigint` throughout to avoid floating-point precision loss on large values (BEAF tips can be `50_000_000n` or larger).
- **CCC auto-resolution.** Payment functions rely on `completeInputsByUdt` to fetch cell deps from the chain, keeping the token definition minimal. Supply `token.cellDep` only when offline or when building custom transactions.
- **Zero npm deps for oracle and utils.** The oracle uses native `fetch` (Node.js 18+). Amount utilities have no runtime imports at all.

## Acknowledgements

- [UTXOSwap](https://utxoswap.xyz) — Decentralised exchange for xUDT/RGB++ tokens on CKB; pool price API used by `fetchXudtPriceUsd` and `fetchXudtPoolData`
- [xUDT RFC #0052](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0052-extensible-udt/0052-extensible-udt.md) — The Extensible UDT standard defining the LE-16 cell data format used by `encodeXudtAmount` / `decodeXudtAmount`
- [CCC (`@ckb-ccc/core`)](https://github.com/ckb-ecofund/ccc) — CKB unified client library used by payment functions for transaction building, address resolution, UDT input completion, and fee calculation
- [Nervos CKB](https://nervos.org) — The Layer 1 blockchain these utilities are built for

## Credits

Built and battle-tested in production by the [Scryve](https://scryve.xyz) team.

## License

MIT
