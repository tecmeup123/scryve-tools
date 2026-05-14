import { ccc } from "@ckb-ccc/core";
export type Network = "mainnet" | "testnet";
export type Identity = string | {
    publicKey?: string;
    address?: string;
};
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
}
export declare function generateAuthNonce(): string;
export declare class NonceStore {
    private store;
    private ttlMs;
    private maxEntries;
    private cleanupTimer;
    constructor(options?: NonceStoreOptions);
    create(address: string): string;
    validate(nonce: string, address: string): boolean;
    cleanup(): void;
    destroy(): void;
    get size(): number;
    private evictOldest;
}
export declare function createChallengeMessage(nonce: string, options?: ChallengeOptions): string;
export declare function verifySignature(message: string, signature: unknown): Promise<VerificationResult>;
export declare function getClient(network?: Network): ccc.Client;
export declare function isTestnetAddress(address: string): boolean;
export declare function deriveAddress(signType: string, identity: Identity, network?: Network): Promise<string | null>;
//# sourceMappingURL=index.d.ts.map