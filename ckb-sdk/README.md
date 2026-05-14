# @scryve-tools/ckb-sdk

The unified CKB developer SDK by [Scryve Tools](https://github.com/scryve/ckb-tools). Installs all five CKB modules under a single package with namespaced exports.

## Install

```bash
npm install @scryve-tools/ckb-sdk @ckb-ccc/core
```

## Usage

```ts
import { walletAuth, witnessData, sporeSeal, paymentSplit, xudtPayment } from "@scryve-tools/ckb-sdk";

// Wallet authentication
const nonce = walletAuth.generateAuthNonce();
const store = new walletAuth.NonceStore();
const result = await walletAuth.verifySignature(message, signature);

// Witness encoding
const hex = witnessData.encodeWitnessHex({ key: "value" }, "mytype", { magic: "MYAPP123" });
const decoded = witnessData.decodeWitnessHex(hex, { magic: "MYAPP123" });

// Spore NFTs
const dna = sporeSeal.createDnaData(contentHash, contentId, "verified");
const dnaHex = sporeSeal.encodeDnaToHex(dna);
const clusterMeta = sporeSeal.createClusterMetadata();

// Payment splitting
const split = paymentSplit.calculateSplit(100, 90, 10);
const minCapacity = await paymentSplit.calculateMinCellCapacity("ckt1q...");

// xUDT / RGB++ token payments
const price = await xudtPayment.fetchXudtPriceUsd(xudtPayment.BEAF);
const amount = xudtPayment.usdToXudtWithSlippage(10, price, 8, 50); // $10, 50bps slippage
const formatted = xudtPayment.formatXudtAmount(amount, 8, "en-US");
```

## Or install modules individually

If you only need specific functionality, install individual packages to keep your bundle lean:

| Module | Package | What it does |
|---|---|---|
| Wallet Auth | `@scryve-tools/ckb-wallet-auth` | Multi-chain auth (CKB, EVM, BTC, JoyID) |
| Witness Data | `@scryve-tools/ckb-witness-data` | Encode/decode arbitrary data in CKB transaction witnesses |
| Spore Seal | `@scryve-tools/ckb-spore-seal` | Spore NFT DNA encoding, DOB/0 patterns, cluster metadata |
| Payment Split | `@scryve-tools/ckb-payment-split` | Cell-capacity-aware payment splitting |
| xUDT Payments | `@scryve-tools/ckb-xudt` | xUDT/RGB++ token amounts, live UTXOSwap pricing, slippage math |

## Requirements

- Node.js 18+
- TypeScript 5+
- `@ckb-ccc/core` (required by `walletAuth` and `paymentSplit` namespaces)

## Acknowledgements

Built on top of:
- [CCC (`@ckb-ccc/core`)](https://github.com/ckb-ecofund/ccc) — CKB unified client library
- [JoyID](https://joy.id) — Passkey-based CKB wallet
- [OmniLock](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0042-omnilock/0042-omnilock.md) — Universal CKB lock for EVM and BTC identities
- [Spore Protocol](https://spore.pro) — On-chain NFT standard on CKB
- [UTXOSwap](https://utxoswap.xyz) — CKB DEX powering live xUDT price feeds
- [Nervos CKB](https://nervos.org) — The underlying Layer 1 blockchain

## Credits

Built and open-sourced by the [Scryve](https://scryve.xyz) team

## License

See [LICENSE](./LICENSE).
