import { ccc } from "@ckb-ccc/core";
export type Network = "mainnet" | "testnet";
export declare const DEFAULT_MIN_CELL_CAPACITY = 63;
export declare const SHANNONS_PER_CKB = 100000000n;
export type CccClient = ccc.ClientPublicTestnet | ccc.ClientPublicMainnet;
export declare function isTestnetAddress(address: string): boolean;
export declare function getClient(network?: Network): CccClient;
export declare function shannonsToCkb(shannons: bigint): number;
export declare function ckbToShannons(ckb: number): bigint;
export declare function calculateMinCellCapacity(address: string, network?: Network): Promise<number>;
export declare function calculateMinCapacityForAddresses(addresses: string[], network?: Network): Promise<{
    address: string;
    minCapacity: number;
}[]>;
export declare function calculateMinTotalForSplit(recipientAddress: string, platformAddress: string, network?: Network): Promise<{
    recipientMin: number;
    platformMin: number;
    totalMin: number;
}>;
export interface SplitResult {
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
export declare function calculateSplit(totalCkb: number, recipientPercent: number, platformPercent: number, minCellCapacity?: number): SplitResult;
export declare function calculateDynamicSplit(totalCkb: number, recipientPercent: number, platformPercent: number, recipientMinCapacity: number, platformMinCapacity: number): SplitResult;
export interface ReferralSplitResult {
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
export declare function calculateReferralSplit(totalCkb: number, referrerPercent: number, platformPercent: number, minCellCapacity?: number): ReferralSplitResult;
//# sourceMappingURL=index.d.ts.map