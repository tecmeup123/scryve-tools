import { randomBytes } from "crypto";
import { ccc } from "@ckb-ccc/core";

export type Network = "mainnet" | "testnet";

export type Identity = string | { publicKey?: string; address?: string };

export interface VerificationResult {
  valid: boolean;
  error?: string;
}

export interface ChallengeOptions {
  prefix?: string;
}

export interface NonceStoreOptions {
  ttlMs?: number;
  maxEntries?: number;
  cleanupIntervalMs?: number;
  maxNoncesPerAddress?: number;
  rateLimitWindowMs?: number;
}

interface NonceEntry {
  address: string;
  createdAt: number;
}

export function generateAuthNonce(): string {
  return randomBytes(32).toString("hex");
}

export class NonceStore {
  private store = new Map<string, NonceEntry>();
  private ttlMs: number;
  private maxEntries: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private rateMap = new Map<string, { count: number; windowStart: number }>();
  private _maxNoncesPerAddress: number;
  private _rateLimitWindowMs: number;

  constructor(options: NonceStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000;
    this.maxEntries = options.maxEntries ?? 10_000;
    this._maxNoncesPerAddress = options.maxNoncesPerAddress ?? 10;
    this._rateLimitWindowMs = options.rateLimitWindowMs ?? 60_000;
    const interval = options.cleanupIntervalMs ?? 60_000;
    this.cleanupTimer = setInterval(() => this.cleanup(), interval);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  create(address: string): string {
    const key = address.toLowerCase();
    const now = Date.now();
    const rate = this.rateMap.get(key);
    if (rate && now - rate.windowStart < this._rateLimitWindowMs) {
      if (rate.count >= this._maxNoncesPerAddress) {
        throw new Error(`Rate limit exceeded: too many auth requests for this address`);
      }
      rate.count++;
    } else {
      this.rateMap.set(key, { count: 1, windowStart: now });
    }
    if (this.store.size >= this.maxEntries) {
      this.evictOldest(Math.ceil(this.maxEntries * 0.1));
    }
    const nonce = generateAuthNonce();
    this.store.set(nonce, {
      address: key,
      createdAt: Date.now(),
    });
    return nonce;
  }

  get maxNoncesPerAddress(): number {
    return this._maxNoncesPerAddress;
  }

  get rateLimitWindowMs(): number {
    return this._rateLimitWindowMs;
  }

  validate(nonce: string, address: string): boolean {
    const entry = this.store.get(nonce);
    if (!entry) return false;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.store.delete(nonce);
      return false;
    }
    if (entry.address !== address.toLowerCase()) return false;
    this.store.delete(nonce);
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [nonce, entry] of this.store) {
      if (now - entry.createdAt > this.ttlMs) {
        this.store.delete(nonce);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
    this.rateMap.clear();
  }

  get size(): number {
    return this.store.size;
  }

  private evictOldest(count: number): void {
    const entries = Array.from(this.store.entries()).sort(
      (a, b) => a[1].createdAt - b[1].createdAt
    );
    for (let i = 0; i < count && i < entries.length; i++) {
      this.store.delete(entries[i][0]);
    }
  }
}

export function createChallengeMessage(
  nonce: string,
  options?: ChallengeOptions
): string {
  const prefix = options?.prefix ?? "Sign to authenticate";
  return `${prefix}: ${nonce}`;
}

export async function verifySignature(
  message: string,
  signature: unknown
): Promise<VerificationResult> {
  try {
    if (!message || !signature) {
      return { valid: false, error: "Missing message or signature" };
    }
    const sig =
      typeof signature === "string" ? JSON.parse(signature) : signature;
    if (!sig || typeof sig !== "object") {
      return { valid: false, error: "Invalid signature format" };
    }
    const valid = await ccc.Signer.verifyMessage(message, sig as any);
    return { valid };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Verification failed";
    return { valid: false, error: errorMessage };
  }
}

export function getClient(network: Network = "testnet"): ccc.Client {
  return network === "mainnet"
    ? new ccc.ClientPublicMainnet()
    : new ccc.ClientPublicTestnet();
}

export function isTestnetAddress(address: string): boolean {
  return address.startsWith("ckt1");
}

function extractString(
  identity: Identity,
  key: "publicKey" | "address"
): string {
  if (typeof identity === "string") return identity;
  return (identity as Record<string, string | undefined>)[key] ?? "";
}

export async function deriveAddress(
  signType: string,
  identity: Identity,
  network: Network = "testnet"
): Promise<string | null> {
  const client = getClient(network);

  try {
    switch (signType) {
      case ccc.SignerSignType.CkbSecp256k1: {
        const pubKey = extractString(identity, "publicKey");
        if (!pubKey) return null;
        const signer = new ccc.SignerCkbPublicKey(client, pubKey);
        const addresses = await signer.getAddresses();
        return addresses.length > 0 ? addresses[0].toString() : null;
      }

      case ccc.SignerSignType.EvmPersonal: {
        const evmAddress = extractString(identity, "address");
        if (!evmAddress) return null;
        const signer = new ccc.SignerEvmAddressReadonly(
          client,
          evmAddress.toLowerCase()
        );
        const addresses = await signer.getAddresses();
        return addresses.length > 0 ? addresses[0].toString() : null;
      }

      case ccc.SignerSignType.BtcEcdsa: {
        let pubKey = extractString(identity, "publicKey");
        if (!pubKey) return null;
        if (pubKey.startsWith("0x")) pubKey = pubKey.slice(2);
        const pubKeyHashBytes = ccc.btcEcdsaPublicKeyHash(pubKey);
        const pubKeyHashHex = ccc.hexFrom(pubKeyHashBytes);
        const omnilockArgs = `0x04${pubKeyHashHex.slice(2)}00`;
        const address = await ccc.Address.fromKnownScript(
          client,
          ccc.KnownScript.OmniLock,
          omnilockArgs
        );
        return address.toString();
      }

      case ccc.SignerSignType.JoyId: {
        const pubKey = extractString(identity, "publicKey");
        if (!pubKey) return null;
        const pubKeyBytes = ccc.bytesFrom(pubKey);
        const hashBytes = ccc.hashCkb(pubKeyBytes);
        const blake160Hex = ccc.hexFrom(hashBytes.slice(0, 20));
        const algIndex = "0001";
        const joyIdArgs = blake160Hex + algIndex;
        const address = await ccc.Address.fromKnownScript(
          client,
          ccc.KnownScript.JoyId,
          joyIdArgs
        );
        return address.toString();
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}
