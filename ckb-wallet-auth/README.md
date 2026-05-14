# ckb-wallet-auth

A standalone, framework-agnostic TypeScript module for multi-chain wallet authentication using CKB's identity system. Supports CKB, Ethereum, Bitcoin, and JoyID wallets through a unified challenge-response flow with CKB address derivation.

## Installation

```bash
npm install @ckb-ccc/core
```

Copy `index.ts` into your project and import what you need.

## API Reference

### `generateAuthNonce(): string`

Generates a cryptographically random 32-byte hex nonce (64 characters).

```ts
import { generateAuthNonce } from "./ckb-wallet-auth";

const nonce = generateAuthNonce();
// => "a3f1c8e9..."
```

---

### `NonceStore`

In-memory nonce store with configurable TTL, max capacity, automatic cleanup, and LRU eviction.

#### Constructor

```ts
new NonceStore(options?: NonceStoreOptions)
```

| Option              | Type     | Default  | Description                          |
|---------------------|----------|----------|--------------------------------------|
| `ttlMs`             | `number` | `300000` | Time-to-live per nonce (5 minutes)   |
| `maxEntries`        | `number` | `10000`  | Maximum stored nonces                |
| `cleanupIntervalMs` | `number` | `60000`  | Interval for expired nonce cleanup   |

#### Methods

| Method                              | Returns   | Description                                              |
|--------------------------------------|-----------|----------------------------------------------------------|
| `create(address: string)`            | `string`  | Generates and stores a nonce for the given address        |
| `validate(nonce: string, address: string)` | `boolean` | Validates and consumes a nonce (one-time use)      |
| `cleanup()`                          | `void`    | Removes all expired nonces                               |
| `destroy()`                          | `void`    | Clears all nonces and stops the cleanup timer            |
| `size` (getter)                      | `number`  | Current number of stored nonces                          |

```ts
import { NonceStore } from "./ckb-wallet-auth";

const store = new NonceStore({ ttlMs: 60_000 });
const nonce = store.create("ckt1q...");
const isValid = store.validate(nonce, "ckt1q...");
// => true (consumed, second call returns false)
```

---

### `createChallengeMessage(nonce: string, options?: ChallengeOptions): string`

Creates a human-readable signing message from a nonce.

| Option   | Type     | Default                  | Description            |
|----------|----------|--------------------------|------------------------|
| `prefix` | `string` | `"Sign to authenticate"` | Message prefix text    |

```ts
import { createChallengeMessage } from "./ckb-wallet-auth";

const message = createChallengeMessage(nonce);
// => "Sign to authenticate: a3f1c8e9..."

const custom = createChallengeMessage(nonce, { prefix: "Login to MyApp" });
// => "Login to MyApp: a3f1c8e9..."
```

---

### `verifySignature(message: string, signature: unknown): Promise<VerificationResult>`

Verifies a CKB-compatible signature using `ccc.Signer.verifyMessage()`.

Returns `{ valid: boolean; error?: string }`. Never throws.

```ts
import { verifySignature } from "./ckb-wallet-auth";

const result = await verifySignature(message, signatureObject);
if (result.valid) {
  // authenticated
} else {
  console.error(result.error);
}
```

---

### `deriveAddress(signType: string, identity: Identity, network?: Network): Promise<string | null>`

Derives a CKB address from a wallet identity. Returns `null` if derivation fails.

**Parameters:**

| Parameter  | Type                                                  | Default      |
|------------|-------------------------------------------------------|--------------|
| `signType` | `string` (use `ccc.SignerSignType` enum values)       | —            |
| `identity` | `string \| { publicKey?: string; address?: string }`  | —            |
| `network`  | `"mainnet" \| "testnet"`                              | `"testnet"`  |

```ts
import { deriveAddress } from "./ckb-wallet-auth";
import { ccc } from "@ckb-ccc/core";

// CKB native wallet
const addr = await deriveAddress(
  ccc.SignerSignType.CkbSecp256k1,
  "0x04abc...",
  "testnet"
);

// EVM wallet (MetaMask, etc.)
const addr2 = await deriveAddress(
  ccc.SignerSignType.EvmPersonal,
  { address: "0x1234...abcd" },
  "mainnet"
);
```

---

### `isTestnetAddress(address: string): boolean`

Returns `true` if the address starts with `"ckt1"` (CKB testnet prefix).

---

### `getClient(network?: Network): ccc.Client`

Returns a `ccc.ClientPublicTestnet()` or `ccc.ClientPublicMainnet()` instance.

---

## Supported Wallet Types

| Sign Type        | Identity Input             | Derivation Method                                  |
|------------------|----------------------------|----------------------------------------------------|
| `CkbSecp256k1`   | Public key (hex string)    | `ccc.SignerCkbPublicKey` → `getAddresses()`        |
| `EvmPersonal`    | EVM address (0x string)    | `ccc.SignerEvmAddressReadonly` → OmniLock address   |
| `BtcEcdsa`       | BTC public key (hex)       | `ccc.btcEcdsaPublicKeyHash` → OmniLock (`0x04`)    |
| `JoyId`          | Public key (hex string)    | `ccc.hashCkb` → JoyId script (`0001` alg index)    |

## Address Derivation Details

### CKB Native (`CkbSecp256k1`)
Takes a secp256k1 public key and derives the standard CKB short address using the default lock script.

### Ethereum (`EvmPersonal`)
Takes an EVM address (e.g., MetaMask) and derives a CKB OmniLock address. The EVM address is used as the lock args, allowing Ethereum users to control CKB assets.

### Bitcoin (`BtcEcdsa`)
Takes a BTC public key, computes `btcEcdsaPublicKeyHash`, and constructs an OmniLock address with `0x04` auth flag prefix. This maps Bitcoin identity to a CKB-compatible address.

### JoyID
Takes a public key, computes `hashCkb` (blake160), and constructs a JoyID lock script address with algorithm index `0001`. JoyID uses WebAuthn-based authentication.

## Complete Usage Example

```ts
import { ccc } from "@ckb-ccc/core";
import {
  NonceStore,
  createChallengeMessage,
  verifySignature,
  deriveAddress,
} from "./ckb-wallet-auth";

// 1. Initialize nonce store (server-side)
const nonceStore = new NonceStore({ ttlMs: 5 * 60 * 1000 });

// 2. Client requests a challenge
const walletAddress = "ckt1q...";
const nonce = nonceStore.create(walletAddress);
const message = createChallengeMessage(nonce);
// Send `message` and `nonce` to the client

// 3. Client signs the message with their wallet
// const signature = await wallet.signMessage(message);

// 4. Server verifies the signature
const { valid, error } = await verifySignature(message, signature);
if (!valid) {
  console.error("Auth failed:", error);
  return;
}

// 5. Validate the nonce (one-time use)
const nonceValid = nonceStore.validate(nonce, walletAddress);
if (!nonceValid) {
  console.error("Nonce expired or already used");
  return;
}

// 6. Derive the CKB address from the wallet identity
const derivedAddr = await deriveAddress(
  ccc.SignerSignType.EvmPersonal,
  { address: "0x1234...abcd" },
  "testnet"
);

// 7. Compare derived address with claimed address
if (derivedAddr === walletAddress) {
  console.log("Authenticated successfully!");
}

// 8. Cleanup on shutdown
nonceStore.destroy();
```

## Exported Types

```ts
type Network = "mainnet" | "testnet";
type Identity = string | { publicKey?: string; address?: string };

interface VerificationResult {
  valid: boolean;
  error?: string;
}

interface ChallengeOptions {
  prefix?: string;
}

interface NonceStoreOptions {
  ttlMs?: number;
  maxEntries?: number;
  cleanupIntervalMs?: number;
}
```

## Acknowledgements

This module is built on top of the following third-party protocols and libraries:

- [CCC (`@ckb-ccc/core`)](https://github.com/ckb-ecofund/ccc) — CKB unified client library. Used for signature verification (`ccc.Signer.verifyMessage`), CKB client creation (`ClientPublicTestnet` / `ClientPublicMainnet`), and all signer types (`SignerCkbPublicKey`, `SignerEvmAddressReadonly`, `btcEcdsaPublicKeyHash`, `hashCkb`).
- [JoyID](https://joy.id) — Passkey-based CKB wallet. JoyID lock script derivation uses `ccc.KnownScript.JoyId` with blake160 public key hash and algorithm index `0001`.
- [OmniLock](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0042-omnilock/0042-omnilock.md) — Universal CKB lock script supporting Ethereum and Bitcoin identities. EVM addresses use auth flag `0x03`, BTC keys use `0x04` prefix via `ccc.KnownScript.OmniLock`.
- [Nervos CKB](https://nervos.org) — The Layer 1 blockchain providing the identity and address system this module authenticates against.

## Credits

Built and open-sourced by the [Scryve](https://scryve.xyz) team Extracted from production for the CKB developer community.

## License

MIT
