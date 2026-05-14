# ckb-spore-seal

A standalone TypeScript module for encoding/decoding Spore NFT DNA, defining DOB/0 patterns, and generating content seal signing messages on Nervos CKB.

## Overview

On Nervos CKB, [Spore Protocol](https://spore.pro) allows creating on-chain NFTs (called "Spores") with embedded DNA — a compact binary payload that encodes structured metadata. This module provides utilities for:

- **DNA encoding/decoding** — pack and unpack 16-byte DNA payloads
- **DOB/0 pattern definitions** — tell DOB decoders how to interpret DNA traits
- **Signing message generation** — create human-readable messages for wallet signing
- **Capacity estimation** — calculate CKB needed to mint a seal Spore
- **Validation** — verify DNA hex strings

No external dependencies. Pure TypeScript.

## DNA Structure (16 bytes)

```
Offset  Length  Field              Description
──────  ──────  ─────              ───────────
0       4       Fingerprint        First 4 bytes of content hash (#XXXXXXXX)
4       4       Timestamp          Unix seconds, little-endian
8       2       Content ID         Up to 65,535, little-endian
10      1       Status             0=Standard, 1=Premium, 2=Verified
11      1       Archived           0=No, 1=Yes (permanent archive)
12      4       Signature Anchor   First 4 bytes of signature (on-chain binding)
──────  ──────
Total: 16 bytes
```

## Installation

Copy `index.ts` into your project. No external dependencies required.

```bash
cp index.ts /your-project/lib/spore-seal.ts
```

## API Reference

### Types

```typescript
type ContentStatus = 'standard' | 'premium' | 'verified';

interface SporeDnaData {
  fingerprint: string;    // e.g. "#A1B2C3D4"
  timestamp: number;      // Unix seconds
  contentId: number;      // 0–65535
  status: ContentStatus;
  archived: boolean;
  signatureAnchor?: string; // e.g. "0xdeadbeef"
}

interface DOBContent {
  dna: string; // hex string for Spore minting
}

interface ClusterMetadata {
  description: string;
  dob: { ver: 0; decoder: { type: "code_hash"; hash: string }; pattern: ... };
}
```

### Constants

| Constant | Value | Description |
|---|---|---|
| `DNA_FINGERPRINT_BYTES` | 4 | Content hash prefix |
| `DNA_TIMESTAMP_BYTES` | 4 | Unix timestamp |
| `DNA_ARTICLE_ID_BYTES` | 2 | Content ID |
| `DNA_STATUS_BYTES` | 1 | Status code |
| `DNA_ARCHIVED_BYTES` | 1 | Archive flag |
| `DNA_SIGNATURE_ANCHOR_BYTES` | 4 | Signature anchor |
| `DNA_TOTAL_BYTES` | 16 | Total DNA size |
| `STATUS_CODES` | `Record<ContentStatus, number>` | Status to code mapping |
| `STATUS_FROM_CODE` | `Record<number, ContentStatus>` | Code to status mapping |
| `STATUS_COLORS` | `Record<ContentStatus, string>` | Hex colors per status |
| `STATUS_LABELS` | `Record<ContentStatus, string>` | Display labels |

### DNA Encoding/Decoding

```typescript
// Create DNA data from content hash
const dnaData = createDnaData(contentHash, contentId, status?, hasArchive?);

// Create with explicit timestamp
const dnaData = createDnaDataWithTimestamp(contentHash, contentId, status?, hasArchive?, timestamp?);

// Encode to 16-byte Uint8Array
const bytes: Uint8Array = encodeDna(dnaData);

// Decode back to data
const decoded: SporeDnaData = decodeDna(bytes);

// Encode to hex string (for ccc.spore.dob.encodeDna())
const hex: string = encodeDnaToHex(dnaData);

// Validate a DNA hex string
const valid: boolean = validateDnaHex(hex);
```

### DOB/0 Pattern & Cluster Metadata

```typescript
// DOB_PATTERN — array of trait definitions for DOB/0 decoders
import { DOB_PATTERN } from './index';

// Create cluster metadata for Spore cluster creation
const metadata = createClusterMetadata(description?);
// Returns: { description, dob: { ver: 0, decoder: {...}, pattern: DOB_PATTERN } }
```

### Signing Messages

```typescript
// Create signing message (uses current timestamp)
const message = createSealSigningMessage(contentHash, contentId, authorAddress, archiveTxId?);

// Create with explicit timestamp
const message = createSealSigningMessageWithTimestamp(contentHash, contentId, authorAddress, timestamp, archiveTxId?);
```

### Capacity & Formatting

```typescript
// Estimate CKB capacity needed for a seal Spore (in shannons)
const capacity: bigint = estimateSealCapacity();

// Format shannons as CKB string
const ckb: string = formatCapacityAsCkb(capacity); // e.g. "62.00"

// Format Unix timestamp as readable date
const date: string = formatSealDate(1700000000); // e.g. "Nov 14, 2023"
```

### DOB Content

```typescript
// Wrap DNA data for Spore minting
const content: DOBContent = createDOBContent(dnaData);
// Returns: { dna: "hexstring" }
```

## Usage Examples

### Create and Encode DNA

```typescript
import { createDnaData, encodeDna, encodeDnaToHex, decodeDna } from './index';

const contentHash = '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const contentId = 42;

// Create DNA data
const dnaData = createDnaData(contentHash, contentId, 'premium', true);
console.log(dnaData.fingerprint); // "#A1B2C3D4"

// Encode to bytes
const bytes = encodeDna(dnaData);
console.log(bytes.length); // 16

// Encode to hex for Spore minting
const hex = encodeDnaToHex(dnaData);
console.log(hex); // "a1b2c3d4..." (32 hex chars)

// Decode back
const decoded = decodeDna(bytes);
console.log(decoded.contentId); // 42
console.log(decoded.status);    // "premium"
```

### Mint a Spore with ccc Library

```typescript
import { createDnaData, createDOBContent, createClusterMetadata, estimateSealCapacity } from './index';
import { ccc } from '@ckb-ccc/core';

// 1. Create cluster (one-time setup)
const metadata = createClusterMetadata();
const clusterData = ccc.spore.dob.encodeClusterDescriptionForDob0(metadata);

// 2. Create DNA for content
const dnaData = createDnaData(contentHash, 1, 'standard');
const dobContent = createDOBContent(dnaData);

// 3. Encode for Spore protocol
const sporeContent = ccc.spore.dob.encodeDna(dobContent);

// 4. Estimate capacity
const capacity = estimateSealCapacity();
console.log(`Need ~${formatCapacityAsCkb(capacity)} CKB`);
```

### Verify DNA from On-Chain Data

```typescript
import { decodeDna, validateDnaHex, STATUS_LABELS, STATUS_COLORS, formatSealDate } from './index';

// Validate hex from chain
if (validateDnaHex(onChainHex)) {
  const bytes = new Uint8Array(Buffer.from(onChainHex, 'hex'));
  const data = decodeDna(bytes);

  console.log(`Content: #${data.contentId}`);
  console.log(`Fingerprint: ${data.fingerprint}`);
  console.log(`Status: ${STATUS_LABELS[data.status]}`);
  console.log(`Color: ${STATUS_COLORS[data.status]}`);
  console.log(`Sealed: ${formatSealDate(data.timestamp)}`);
  console.log(`Archived: ${data.archived ? 'Yes' : 'No'}`);
  console.log(`Sig Anchor: ${data.signatureAnchor}`);
}
```

## DOB/0 Pattern

The `DOB_PATTERN` array defines how DOB/0 decoders interpret the 16-byte DNA. Each entry maps a byte range to a named trait:

| Trait | Type | Offset | Length | Pattern | Values |
|---|---|---|---|---|---|
| Content # | Number | 8 | 2 | rawNumber | — |
| Status | String | 10 | 1 | options | Standard, Premium, Verified |
| Archived | String | 11 | 1 | options | No, Yes |
| Fingerprint | String | 0 | 4 | rawString | — |
| Sealed (Unix) | Number | 4 | 4 | rawNumber | — |
| SigAnchor | String | 12 | 4 | rawString | — |
| prev.bgcolor | String | 10 | 1 | options | #1D9BF0, #D4A853, #9333EA |

The `prev.bgcolor` trait enables DOB renderers to display status-appropriate background colors automatically.

The decoder hash `0x13cac78ad8482202f18f9df4ea707611c35f994375fa03ae79121312dda9925c` references the standard DOB/0 code_hash decoder on CKB.

## Acknowledgements

This module is built on top of the following third-party protocols:

- [Spore Protocol](https://spore.pro) — The on-chain NFT standard for Nervos CKB that defines how Spores (NFTs) and Clusters (collections) are minted, structured, and stored. This module's DNA layout, `DOBContent`, and `ClusterMetadata` conform to the Spore data format.
- [DOB/0 Decoder](https://github.com/sporeprotocol/dob-decoder-standalone-server) — The standard DOB decoder referenced by `createClusterMetadata`. The decoder code hash `0x13cac78ad8482202f18f9df4ea707611c35f994375fa03ae79121312dda9925c` maps DNA byte ranges to displayable NFT traits (name, status, color, etc.).
- [Nervos CKB](https://nervos.org) — The underlying Layer 1 blockchain on which Spore NFTs are minted. Capacity estimates and the Shannon unit (`1 CKB = 10^8 shannons`) follow CKB's cell model.

## Credits

Built and open-sourced by the [Scryve](https://scryve.io) team Originally developed for on-chain content sealing and authorship verification on CKB mainnet.

## License

MIT
