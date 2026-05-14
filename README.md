# @scryve-tools/ckb-modules

Production-tested TypeScript utilities for building on the CKB blockchain. Extracted from a live production application and open-sourced for the CKB developer community.

## Packages

### Open-source (MIT)

| Package | npm | Description |
|---|---|---|
| [`ckb-wallet-auth`](./ckb-wallet-auth/) | `@scryve-tools/ckb-wallet-auth` | Multi-chain wallet auth (CKB, EVM, BTC, JoyID) |
| [`ckb-spore-seal`](./ckb-spore-seal/) | `@scryve-tools/ckb-spore-seal` | Spore NFT DNA encoding, DOB/0 patterns, cluster metadata |
| [`ckb-witness-data`](./ckb-witness-data/) | `@scryve-tools/ckb-witness-data` | Encode/decode arbitrary data in CKB transaction witnesses |
| [`ckb-xudt`](./ckb-xudt/) | `@scryve-tools/ckb-xudt` | xUDT/RGB++ token amounts, UTXOSwap price oracle, LE-16 cell encoding |

### Source-available (Scryve SAL v1.0 — free for non-commercial use)

| Package | npm | Description |
|---|---|---|
| [`ckb-payment-split`](./ckb-payment-split/) | `@scryve-tools/ckb-payment-split` | Cell-capacity-aware payment splitting with dust-limit rebalancing |
| [`ckb-sdk`](./ckb-sdk/) | `@scryve-tools/ckb-sdk` | Unified package — all five modules in one install |

> Commercial use of the source-available packages requires a written license from Lusocrypto Labs.
> Contact **support@scryvehq.com** — packages auto-relicense to Apache 2.0 four years after first release.

## Install

### Option A — Unified SDK (all modules)

```bash
npm install @scryve-tools/ckb-sdk @ckb-ccc/core
```

```ts
import { walletAuth, witnessData, sporeSeal, paymentSplit, xudtPayment } from "@scryve-tools/ckb-sdk";
```

### Option B — Individual modules (pick what you need)

```bash
npm install @scryve-tools/ckb-wallet-auth @ckb-ccc/core   # wallet auth
npm install @scryve-tools/ckb-witness-data                 # witness encoding (no deps)
npm install @scryve-tools/ckb-spore-seal                   # Spore NFTs (no deps)
npm install @scryve-tools/ckb-payment-split @ckb-ccc/core  # payment splitting
npm install @scryve-tools/ckb-xudt                         # xUDT tokens + pricing
```

## Requirements

- Node.js 18+
- TypeScript 5+
- `@ckb-ccc/core ^1.12.5` — required by `ckb-wallet-auth`, `ckb-payment-split`, and xUDT payment functions

## Module Descriptions

### [`ckb-wallet-auth`](./ckb-wallet-auth/)
Multi-chain wallet authentication using CKB's identity system. Supports CKB native, Ethereum (EVM), Bitcoin (BTC Taproot), and JoyID wallets. Includes challenge-response nonce flow, cryptographic signature verification, OmniLock address derivation, and sliding-window rate limiting.

### [`ckb-witness-data`](./ckb-witness-data/)
Generic witness data encoding for CKB transactions. Embed arbitrary structured data in transaction witnesses using a magic-byte-prefixed binary format. Zero capacity cost — witness data is ~2,000,000× cheaper than storing data in cell outputs.

### [`ckb-spore-seal`](./ckb-spore-seal/)
Spore NFT minting utilities. Encode/decode 16-byte DNA structures for Spore NFTs, define DOB/0 display patterns, generate cluster metadata, and create signing messages.

### [`ckb-payment-split`](./ckb-payment-split/)
CKB payment splitting with cell capacity awareness. Dynamically calculates minimum cell capacity for any CKB address (secp256k1, OmniLock, JoyID), splits payments between multiple recipients, and auto-rebalances when amounts approach the dust limit.

### [`ckb-xudt`](./ckb-xudt/)
xUDT / RGB++ token payments on CKB. Handles little-endian 16-byte cell data encoding, live USD price lookups via the UTXOSwap pool API, slippage protection, and correct CKB transaction construction for single and split token payments. Ships with a built-in `BEAF` token constant (production-verified mainnet values).

### [`ckb-sdk`](./ckb-sdk/)
Umbrella package that re-exports all five modules under namespaced exports. One install, one import.

## Development

```bash
npm install          # install all workspace dependencies
npm run build:all    # build all packages (CJS + ESM)
npm run test:all     # run all tests
```

## Acknowledgements

- [CCC (`@ckb-ccc/core`)](https://github.com/ckb-ecofund/ccc) — CKB unified client library
- [JoyID](https://joy.id) — Passkey-based CKB wallet
- [OmniLock](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0042-omnilock/0042-omnilock.md) — Universal CKB lock script for EVM and BTC identities
- [Spore Protocol](https://spore.pro) — On-chain NFT standard on CKB
- [UTXOSwap](https://utxoswap.xyz) — CKB DEX powering live xUDT price feeds
- [xUDT RFC #0052](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0052-extensible-udt/0052-extensible-udt.md) — LE-16 cell data format spec
- [Nervos CKB](https://nervos.org) — The underlying Layer 1 blockchain

## License

**MIT** — [`ckb-wallet-auth`](./ckb-wallet-auth/LICENSE), [`ckb-spore-seal`](./ckb-spore-seal/LICENSE), [`ckb-witness-data`](./ckb-witness-data/LICENSE), [`ckb-xudt`](./ckb-xudt/LICENSE)

**Scryve Source-Available License v1.0** — [`ckb-payment-split`](./ckb-payment-split/LICENSE), [`ckb-sdk`](./ckb-sdk/LICENSE)
Free for personal, academic, and non-commercial open-source use. Commercial deployment requires a written license — contact **support@scryvehq.com**.

## Credits

Built by the [Scryve](https://scryve.xyz) team
