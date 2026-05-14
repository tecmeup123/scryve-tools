import { ccc } from "@ckb-ccc/core";

export type Network = "mainnet" | "testnet";

export const DEFAULT_MIN_CELL_CAPACITY = 63;
/** Minimum cell capacity for a standard secp256k1 address (8 + 32 + 1 + 20 bytes). */
export const SECP256K1_MIN_CAPACITY = 61;
export const SHANNONS_PER_CKB = 100_000_000n;

export type CccClient = ccc.ClientPublicTestnet | ccc.ClientPublicMainnet;

const clientTestnet = new ccc.ClientPublicTestnet();
const clientMainnet = new ccc.ClientPublicMainnet();

export function isTestnetAddress(address: string): boolean {
  return address.startsWith("ckt1");
}

export function getClient(network?: Network): CccClient {
  return network === "mainnet" ? clientMainnet : clientTestnet;
}

export function shannonsToCkb(shannons: bigint): number {
  return Number(shannons) / Number(SHANNONS_PER_CKB);
}

export function ckbToShannons(ckb: number): bigint {
  return BigInt(Math.round(ckb * Number(SHANNONS_PER_CKB)));
}

/**
 * @throws If the address cannot be parsed or the capacity cannot be determined.
 *         Callers that want a safe fallback can use `.catch(() => SECP256K1_MIN_CAPACITY)`.
 */
export async function calculateMinCellCapacity(
  address: string,
  network?: Network
): Promise<number> {
  try {
    const client = network
      ? getClient(network)
      : isTestnetAddress(address)
        ? clientTestnet
        : clientMainnet;

    const addressObj = await ccc.Address.fromString(address, client);
    const lockScript = addressObj.script;

    const codeHashBytes = 32;
    const hashTypeBytes = 1;
    const argsHex = lockScript.args.startsWith("0x")
      ? lockScript.args.slice(2)
      : lockScript.args;
    const argsBytes = argsHex.length / 2;

    const capacityFieldBytes = 8;
    return capacityFieldBytes + codeHashBytes + hashTypeBytes + argsBytes;
  } catch (err: unknown) {
    throw err;
  }
}

export async function calculateMinCapacityForAddresses(
  addresses: string[],
  network?: Network
): Promise<{ address: string; minCapacity: number }[]> {
  return Promise.all(
    addresses.map(async (address) => ({
      address,
      minCapacity: await calculateMinCellCapacity(address, network),
    }))
  );
}

export async function calculateMinTotalForSplit(
  recipientAddress: string,
  platformAddress: string,
  network?: Network
): Promise<{ recipientMin: number; platformMin: number; totalMin: number }> {
  const [recipientMin, platformMin] = await Promise.all([
    calculateMinCellCapacity(recipientAddress, network),
    calculateMinCellCapacity(platformAddress, network),
  ]);

  return { recipientMin, platformMin, totalMin: recipientMin + platformMin };
}

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

export function calculateSplit(
  totalCkb: number,
  recipientPercent: number,
  platformPercent: number,
  minCellCapacity: number = DEFAULT_MIN_CELL_CAPACITY
): SplitResult {
  const minTotal = minCellCapacity * 2;

  if (totalCkb < minTotal) {
    return {
      totalCkb,
      recipientCkb: 0,
      platformCkb: 0,
      originalRecipientPercent: recipientPercent,
      originalPlatformPercent: platformPercent,
      adjustedRecipientPercent: 0,
      adjustedPlatformPercent: 0,
      wasAdjusted: false,
      isValid: false,
      invalidReason: `Total amount (${totalCkb.toFixed(2)} CKB) is below minimum required (${minTotal} CKB). Each output cell needs at least ${minCellCapacity} CKB.`,
    };
  }

  let recipientCkb = (totalCkb * recipientPercent) / 100;
  let platformCkb = (totalCkb * platformPercent) / 100;
  let wasAdjusted = false;

  if (platformCkb < minCellCapacity) {
    platformCkb = minCellCapacity;
    recipientCkb = totalCkb - minCellCapacity;
    wasAdjusted = true;
  }

  if (recipientCkb < minCellCapacity) {
    recipientCkb = minCellCapacity;
    platformCkb = totalCkb - minCellCapacity;
    wasAdjusted = true;
  }

  const adjustedRecipientPercent = (recipientCkb / totalCkb) * 100;
  const adjustedPlatformPercent = (platformCkb / totalCkb) * 100;

  return {
    totalCkb,
    recipientCkb: Math.floor(recipientCkb * 100) / 100,
    platformCkb: Math.floor(platformCkb * 100) / 100,
    originalRecipientPercent: recipientPercent,
    originalPlatformPercent: platformPercent,
    adjustedRecipientPercent: Math.round(adjustedRecipientPercent * 100) / 100,
    adjustedPlatformPercent: Math.round(adjustedPlatformPercent * 100) / 100,
    wasAdjusted,
    isValid: true,
  };
}

export function calculateDynamicSplit(
  totalCkb: number,
  recipientPercent: number,
  platformPercent: number,
  recipientMinCapacity: number,
  platformMinCapacity: number
): SplitResult {
  const minTotal = recipientMinCapacity + platformMinCapacity;

  if (totalCkb < minTotal) {
    return {
      totalCkb,
      recipientCkb: 0,
      platformCkb: 0,
      originalRecipientPercent: recipientPercent,
      originalPlatformPercent: platformPercent,
      adjustedRecipientPercent: 0,
      adjustedPlatformPercent: 0,
      wasAdjusted: false,
      isValid: false,
      invalidReason: `Total amount (${totalCkb.toFixed(2)} CKB) is below minimum required (${minTotal} CKB). Recipient needs ${recipientMinCapacity} CKB and platform needs ${platformMinCapacity} CKB.`,
    };
  }

  let recipientCkb = (totalCkb * recipientPercent) / 100;
  let platformCkb = (totalCkb * platformPercent) / 100;
  let wasAdjusted = false;

  if (platformCkb < platformMinCapacity) {
    platformCkb = platformMinCapacity;
    recipientCkb = totalCkb - platformMinCapacity;
    wasAdjusted = true;
  }

  if (recipientCkb < recipientMinCapacity) {
    recipientCkb = recipientMinCapacity;
    platformCkb = totalCkb - recipientMinCapacity;
    wasAdjusted = true;
  }

  const adjustedRecipientPercent = (recipientCkb / totalCkb) * 100;
  const adjustedPlatformPercent = (platformCkb / totalCkb) * 100;

  return {
    totalCkb,
    recipientCkb: Math.floor(recipientCkb * 100) / 100,
    platformCkb: Math.floor(platformCkb * 100) / 100,
    originalRecipientPercent: recipientPercent,
    originalPlatformPercent: platformPercent,
    adjustedRecipientPercent: Math.round(adjustedRecipientPercent * 100) / 100,
    adjustedPlatformPercent: Math.round(adjustedPlatformPercent * 100) / 100,
    wasAdjusted,
    isValid: true,
  };
}

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

export function calculateReferralSplit(
  totalCkb: number,
  referrerPercent: number,
  platformPercent: number,
  minCellCapacity: number = DEFAULT_MIN_CELL_CAPACITY
): ReferralSplitResult {
  const minTotal = minCellCapacity * 2;

  if (totalCkb < minTotal) {
    return {
      totalCkb,
      referrerCkb: 0,
      platformCkb: 0,
      originalReferrerPercent: referrerPercent,
      originalPlatformPercent: platformPercent,
      adjustedReferrerPercent: 0,
      adjustedPlatformPercent: 0,
      wasAdjusted: false,
      isValid: false,
      invalidReason: `Total amount (${totalCkb.toFixed(2)} CKB) is below minimum required (${minTotal} CKB). Each output cell needs at least ${minCellCapacity} CKB.`,
    };
  }

  let referrerCkb = (totalCkb * referrerPercent) / 100;
  let platformCkb = (totalCkb * platformPercent) / 100;
  let wasAdjusted = false;

  if (platformCkb < minCellCapacity) {
    platformCkb = minCellCapacity;
    referrerCkb = totalCkb - minCellCapacity;
    wasAdjusted = true;
  }

  if (referrerCkb < minCellCapacity) {
    referrerCkb = minCellCapacity;
    platformCkb = totalCkb - minCellCapacity;
    wasAdjusted = true;
  }

  const adjustedReferrerPercent = (referrerCkb / totalCkb) * 100;
  const adjustedPlatformPercent = (platformCkb / totalCkb) * 100;

  return {
    totalCkb,
    referrerCkb: Math.floor(referrerCkb * 100) / 100,
    platformCkb: Math.floor(platformCkb * 100) / 100,
    originalReferrerPercent: referrerPercent,
    originalPlatformPercent: platformPercent,
    adjustedReferrerPercent: Math.round(adjustedReferrerPercent * 100) / 100,
    adjustedPlatformPercent: Math.round(adjustedPlatformPercent * 100) / 100,
    wasAdjusted,
    isValid: true,
  };
}
