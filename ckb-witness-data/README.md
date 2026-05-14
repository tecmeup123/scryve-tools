# ckb-witness-data

A generic, standalone TypeScript module for encoding and decoding structured data in CKB (Nervos Common Knowledge Base) transaction witnesses.

## Why Witness Data?

On CKB, storing data in **cell outputs** requires locking CKB tokens as capacity (1 CKB per byte). Witness data, by contrast, is included in the transaction but does **not** consume cell capacity. This makes witnesses ideal for metadata, receipts, and proofs that need to be permanently on-chain but don't need to be referenced by other transactions.

| | Cell Data | Witness Data |
|---|---|---|
| **Storage cost** | 1 CKB per byte (~$0.005/byte at $0.005/CKB) | Transaction fee only (~0.0001 CKB) |
| **Capacity lock** | Tokens locked until cell is consumed | No capacity locked |
| **Persistence** | Until cell is spent | Permanent in transaction history |
| **Queryable** | Yes (live cells) | Yes (via transaction hash) |
| **Typical 200-byte record** | ~200 CKB locked (~$1.00) | ~0.0001 CKB fee (~$0.0000005) |

## Binary Format

```
┌──────────────────┬───────────┬──────────────────────────┐
│  MAGIC (8 bytes) │ VER (1B)  │     JSON PAYLOAD         │
│  "WITNESHQ"      │  0x01     │  { t, v, ...data }       │
└──────────────────┴───────────┴──────────────────────────┘
```

- **MAGIC** — 8-byte ASCII identifier (default `"WITNESHQ"`, configurable per app)
- **VERSION** — 1-byte version number (default `0x01`)
- **JSON PAYLOAD** — UTF-8 encoded JSON containing `t` (type), `v` (version), and spread data fields

## Installation

Zero dependencies. Copy `index.ts` into your project:

```bash
cp ckb-witness-data/index.ts src/lib/witness-data.ts
```

## API Reference

### Constants

```typescript
DEFAULT_MAGIC: string   // "WITNESHQ"
DEFAULT_VERSION: number // 0x01
```

### Types

```typescript
interface WitnessOptions {
  magic?: string;    // Override magic bytes (default "WITNESHQ")
  version?: number;  // Override version byte (default 0x01)
}

interface WitnessPayload<T> {
  type: string;      // Record type identifier
  version: number;   // Format version
  data: T;           // Decoded data
}

interface SealRecord {
  contentHash: string;
  contentId: number;
  authorAddress: string;
  timestamp: string;
  contentVersion?: number;
  contentTitle?: string;
  contentSlug?: string;
  archiveTxId?: string;
}

interface PaymentReceiptRecord {
  senderAddress: string;
  recipientAddress: string;
  contentId: number;
  amountCkb: string;
  timestamp: string;
}
```

### Generic Encoding/Decoding

```typescript
// Encode any data type into witness bytes
encodeWitness<T>(data: T, type: string, options?: WitnessOptions): Uint8Array

// Encode as 0x-prefixed hex string
encodeWitnessHex<T>(data: T, type: string, options?: WitnessOptions): string

// Decode witness bytes back to typed payload (returns null on failure)
decodeWitness<T>(bytes: Uint8Array, options?: { magic?: string }): WitnessPayload<T> | null

// Decode from hex string
decodeWitnessHex<T>(hex: string, options?: { magic?: string }): WitnessPayload<T> | null

// Check if hex starts with magic bytes
isWitnessHex(hex: string, magic?: string): boolean

// Check if bytes start with magic bytes
isWitnessBytes(bytes: Uint8Array, magic?: string): boolean
```

### Content Seal Functions

```typescript
encodeSealWitness(data: SealRecord, options?: WitnessOptions): Uint8Array
encodeSealWitnessHex(data: SealRecord, options?: WitnessOptions): string
decodeSealWitness(bytes: Uint8Array, options?: { magic?: string }): SealRecord | null
decodeSealWitnessHex(hex: string, options?: { magic?: string }): SealRecord | null
isSealWitnessHex(hex: string, magic?: string): boolean
createSealDisplayMessage(data: SealRecord): string
```

### Payment Receipt Functions

```typescript
encodePaymentReceiptWitness(data: PaymentReceiptRecord, options?: WitnessOptions): Uint8Array
encodePaymentReceiptWitnessHex(data: PaymentReceiptRecord, options?: WitnessOptions): string
decodePaymentReceiptWitness(bytes: Uint8Array, options?: { magic?: string }): PaymentReceiptRecord | null
decodePaymentReceiptWitnessHex(hex: string, options?: { magic?: string }): PaymentReceiptRecord | null
isPaymentReceiptWitnessHex(hex: string, magic?: string): boolean
createPaymentReceiptDisplayMessage(data: PaymentReceiptRecord): string
```

## Usage Examples

### 1. Generic Encoding/Decoding with Custom Data

```typescript
import { encodeWitnessHex, decodeWitnessHex } from "./index";

interface VoteRecord {
  proposalId: number;
  voter: string;
  choice: "yes" | "no" | "abstain";
}

const vote: VoteRecord = {
  proposalId: 42,
  voter: "ckt1qz...",
  choice: "yes",
};

const hex = encodeWitnessHex(vote, "vote");
// "0x5749544e455348510148..."

const decoded = decodeWitnessHex<VoteRecord>(hex);
// { type: "vote", version: 1, data: { proposalId: 42, voter: "ckt1qz...", choice: "yes" } }
```

### 2. Content Seal Encoding/Decoding

```typescript
import { encodeSealWitnessHex, decodeSealWitnessHex } from "./index";

const seal = {
  contentHash: "sha256:abc123...",
  contentId: 1,
  authorAddress: "ckt1qz...",
  timestamp: new Date().toISOString(),
  contentTitle: "My Article",
  contentSlug: "my-article",
};

const hex = encodeSealWitnessHex(seal);
const decoded = decodeSealWitnessHex(hex);
// { contentHash: "sha256:abc123...", contentId: 1, authorAddress: "ckt1qz...", ... }
```

### 3. Payment Receipt Encoding/Decoding

```typescript
import { encodePaymentReceiptWitnessHex, decodePaymentReceiptWitnessHex } from "./index";

const receipt = {
  senderAddress: "ckt1qz..sender",
  recipientAddress: "ckt1qz..recipient",
  contentId: 1,
  amountCkb: "100.00",
  timestamp: new Date().toISOString(),
};

const hex = encodePaymentReceiptWitnessHex(receipt);
const decoded = decodePaymentReceiptWitnessHex(hex);
// { senderAddress: "ckt1qz..sender", recipientAddress: "ckt1qz..recipient", ... }
```

### 4. Custom Magic Bytes

```typescript
import { encodeWitnessHex, decodeWitnessHex } from "./index";

const hex = encodeWitnessHex(
  { key: "value" },
  "config",
  { magic: "MYAPP123" }
);

const decoded = decodeWitnessHex(hex, { magic: "MYAPP123" });
// Works! Different apps can use different magic bytes to avoid collisions
```

### 5. Checking if a Witness Contains Your Data

```typescript
import { isWitnessHex, isSealWitnessHex, isPaymentReceiptWitnessHex } from "./index";

const witnessHex = "0x5749544e455348510148...";

if (isWitnessHex(witnessHex)) {
  console.log("This witness was encoded with default magic bytes");
}

if (isSealWitnessHex(witnessHex)) {
  console.log("This is a content seal record");
}

if (isPaymentReceiptWitnessHex(witnessHex)) {
  console.log("This is a payment receipt record");
}
```

## Cost Comparison

For a typical 200-byte authorship seal:

| Approach | CKB Cost | USD (at $0.005/CKB) | Recoverable? |
|---|---|---|---|
| Cell output data | ~200 CKB locked | ~$1.00 | Yes, when cell consumed |
| Witness data | ~0.0001 CKB fee | ~$0.0000005 | N/A (fee only) |

Witness data is **~2,000,000x cheaper** per record for permanent on-chain storage when you don't need the data to be queryable as a live cell.

## Acknowledgements

This module implements the following third-party specifications:

- [CKB Transaction Witness Format](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0022-transaction-structure/0022-transaction-structure.md) — The RFC defining CKB's transaction structure, including the witness field that this module encodes data into. Witness data is included in transactions but does not consume on-chain cell capacity.

## Credits

Built and open-sourced by the [Scryve](https://scryve.app) team Built for real-world content authenticity and payment receipt use cases on CKB mainnet.

## License

MIT License
