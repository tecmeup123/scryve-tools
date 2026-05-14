export const DEFAULT_MAGIC = "WITNESHQ";
export const DEFAULT_VERSION = 0x01;

export interface WitnessOptions {
  magic?: string;
  version?: number;
}

export interface WitnessPayload<T> {
  type: string;
  version: number;
  data: T;
}

export interface SealRecord {
  contentHash: string;
  contentId: number;
  authorAddress: string;
  timestamp: string;
  contentVersion?: number;
  contentTitle?: string;
  contentSlug?: string;
  archiveTxId?: string;
}

export interface PaymentReceiptRecord {
  senderAddress: string;
  recipientAddress: string;
  contentId: number;
  amountCkb: string;
  timestamp: string;
}

function toHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const hexStr = hex.startsWith("0x") ? hex.slice(2) : hex;
  return new Uint8Array(
    hexStr.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );
}

function getMagicBytes(magic?: string): Uint8Array {
  return new TextEncoder().encode(magic || DEFAULT_MAGIC);
}

export function encodeWitness<T>(data: T, type: string, options?: WitnessOptions): Uint8Array {
  const magic = options?.magic || DEFAULT_MAGIC;
  const version = options?.version ?? DEFAULT_VERSION;

  const jsonData = JSON.stringify({ t: type, v: version, ...(data as object) });

  const magicBytes = new TextEncoder().encode(magic);
  const jsonBytes = new TextEncoder().encode(jsonData);

  const result = new Uint8Array(magicBytes.length + 1 + jsonBytes.length);
  result.set(magicBytes, 0);
  result[magicBytes.length] = version;
  result.set(jsonBytes, magicBytes.length + 1);

  return result;
}

export function encodeWitnessHex<T>(data: T, type: string, options?: WitnessOptions): string {
  return toHex(encodeWitness(data, type, options));
}

export function decodeWitness<T>(bytes: Uint8Array, options?: { magic?: string }): WitnessPayload<T> | null {
  try {
    const magic = options?.magic || DEFAULT_MAGIC;
    const magicBytes = new TextEncoder().encode(magic);

    if (bytes.length < magicBytes.length + 1) {
      return null;
    }

    const foundMagic = new TextDecoder().decode(bytes.slice(0, magicBytes.length));
    if (foundMagic !== magic) {
      return null;
    }

    const version = bytes[magicBytes.length];
    const jsonStr = new TextDecoder().decode(bytes.slice(magicBytes.length + 1));
    const parsed = JSON.parse(jsonStr);

    const { t, v, ...data } = parsed;

    return {
      type: t,
      version: v,
      data: data as T,
    };
  } catch {
    return null;
  }
}

export function decodeWitnessHex<T>(hex: string, options?: { magic?: string }): WitnessPayload<T> | null {
  try {
    return decodeWitness<T>(fromHex(hex), options);
  } catch {
    return null;
  }
}

export function isWitnessHex(hex: string, magic?: string): boolean {
  try {
    const hexStr = hex.startsWith("0x") ? hex.slice(2) : hex;
    const magicHex = Array.from(getMagicBytes(magic))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    return hexStr.startsWith(magicHex);
  } catch {
    return false;
  }
}

export function isWitnessBytes(bytes: Uint8Array, magic?: string): boolean {
  try {
    const magicBytes = getMagicBytes(magic);
    if (bytes.length < magicBytes.length) {
      return false;
    }
    for (let i = 0; i < magicBytes.length; i++) {
      if (bytes[i] !== magicBytes[i]) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function encodeSealWitness(data: SealRecord, options?: WitnessOptions): Uint8Array {
  const compact = {
    a: data.contentId,
    ver: data.contentVersion || null,
    title: data.contentTitle || null,
    slug: data.contentSlug || null,
    h: data.contentHash,
    w: data.authorAddress,
    ts: data.timestamp,
    ar: data.archiveTxId || null,
  };
  return encodeWitness(compact, "seal", options);
}

export function encodeSealWitnessHex(data: SealRecord, options?: WitnessOptions): string {
  return toHex(encodeSealWitness(data, options));
}

export function decodeSealWitness(bytes: Uint8Array, options?: { magic?: string }): SealRecord | null {
  try {
    const payload = decodeWitness<Record<string, unknown>>(bytes, options);
    if (!payload || payload.type !== "seal") {
      return null;
    }
    const d = payload.data;
    return {
      contentHash: d.h as string,
      contentId: d.a as number,
      authorAddress: d.w as string,
      timestamp: d.ts as string,
      contentVersion: (d.ver as number) || undefined,
      contentTitle: (d.title as string) || undefined,
      contentSlug: (d.slug as string) || undefined,
      archiveTxId: (d.ar as string) || undefined,
    };
  } catch {
    return null;
  }
}

export function decodeSealWitnessHex(hex: string, options?: { magic?: string }): SealRecord | null {
  try {
    return decodeSealWitness(fromHex(hex), options);
  } catch {
    return null;
  }
}

export function isSealWitnessHex(hex: string, magic?: string): boolean {
  try {
    const payload = decodeWitnessHex<Record<string, unknown>>(hex, { magic });
    return payload !== null && payload.type === "seal";
  } catch {
    return false;
  }
}

export function encodePaymentReceiptWitness(data: PaymentReceiptRecord, options?: WitnessOptions): Uint8Array {
  const compact = {
    from: data.senderAddress,
    to: data.recipientAddress,
    a: data.contentId,
    amt: data.amountCkb,
    ts: data.timestamp,
  };
  return encodeWitness(compact, "payment", options);
}

export function encodePaymentReceiptWitnessHex(data: PaymentReceiptRecord, options?: WitnessOptions): string {
  return toHex(encodePaymentReceiptWitness(data, options));
}

export function decodePaymentReceiptWitness(bytes: Uint8Array, options?: { magic?: string }): PaymentReceiptRecord | null {
  try {
    const payload = decodeWitness<Record<string, unknown>>(bytes, options);
    if (!payload || payload.type !== "payment") {
      return null;
    }
    const d = payload.data;
    return {
      senderAddress: d.from as string,
      recipientAddress: d.to as string,
      contentId: d.a as number,
      amountCkb: d.amt as string,
      timestamp: d.ts as string,
    };
  } catch {
    return null;
  }
}

export function decodePaymentReceiptWitnessHex(hex: string, options?: { magic?: string }): PaymentReceiptRecord | null {
  try {
    return decodePaymentReceiptWitness(fromHex(hex), options);
  } catch {
    return null;
  }
}

export function isPaymentReceiptWitnessHex(hex: string, magic?: string): boolean {
  try {
    const payload = decodeWitnessHex<Record<string, unknown>>(hex, { magic });
    return payload !== null && payload.type === "payment";
  } catch {
    return false;
  }
}

export function createSealDisplayMessage(data: SealRecord): string {
  const lines = [
    "Content Authorship Seal",
    "",
    `Content ID: ${data.contentId}`,
  ];

  if (data.contentVersion) {
    lines.push(`Version: ${data.contentVersion}`);
  }

  if (data.contentTitle) {
    lines.push(`Title: ${data.contentTitle}`);
  }

  lines.push(`Content Hash: ${data.contentHash}`);
  lines.push(`Author: ${data.authorAddress}`);
  lines.push(`Timestamp: ${data.timestamp}`);

  if (data.contentSlug) {
    lines.push(`Slug: ${data.contentSlug}`);
  }

  if (data.archiveTxId) {
    lines.push(`Archive TX: ${data.archiveTxId}`);
  }

  lines.push("");
  lines.push("This seal is permanently recorded on the CKB blockchain.");

  return lines.join("\n");
}

export function createPaymentReceiptDisplayMessage(data: PaymentReceiptRecord): string {
  return [
    "Payment Receipt",
    "",
    `From: ${data.senderAddress}`,
    `To: ${data.recipientAddress}`,
    `Content ID: ${data.contentId}`,
    `Amount: ${data.amountCkb} CKB`,
    `Timestamp: ${data.timestamp}`,
    "",
    "This payment receipt is permanently recorded on the CKB blockchain.",
  ].join("\n");
}
