export type ContentStatus = 'standard' | 'premium' | 'verified';

export interface SporeDnaData {
  fingerprint: string;
  timestamp: number;
  contentId: number;
  status: ContentStatus;
  archived: boolean;
  signatureAnchor?: string;
}

export interface DOBContent {
  dna: string;
}

export interface ClusterMetadata {
  description: string;
  dob: {
    ver: 0;
    decoder: {
      type: "code_hash";
      hash: string;
    };
    pattern: typeof DOB_PATTERN;
  };
}

export const DNA_FINGERPRINT_BYTES = 4;
export const DNA_TIMESTAMP_BYTES = 4;
export const DNA_ARTICLE_ID_BYTES = 2;
export const DNA_STATUS_BYTES = 1;
export const DNA_ARCHIVED_BYTES = 1;
export const DNA_SIGNATURE_ANCHOR_BYTES = 4;
export const DNA_TOTAL_BYTES = 16;

export const STATUS_CODES: Record<ContentStatus, number> = {
  standard: 0,
  premium: 1,
  verified: 2,
};

export const STATUS_FROM_CODE: Record<number, ContentStatus> = {
  0: 'standard',
  1: 'premium',
  2: 'verified',
};

export const STATUS_COLORS: Record<ContentStatus, string> = {
  standard: '#1D9BF0',
  premium: '#D4A853',
  verified: '#9333EA',
};

export const STATUS_LABELS: Record<ContentStatus, string> = {
  standard: 'Standard',
  premium: 'Premium',
  verified: 'Verified',
};

export const DOB_PATTERN = [
  {
    traitName: "Content #",
    dobType: "Number" as const,
    dnaOffset: 8,
    dnaLength: 2,
    patternType: "rawNumber" as const,
  },
  {
    traitName: "Status",
    dobType: "String" as const,
    dnaOffset: 10,
    dnaLength: 1,
    patternType: "options" as const,
    traitArgs: ["Standard", "Premium", "Verified"],
  },
  {
    traitName: "Archived",
    dobType: "String" as const,
    dnaOffset: 11,
    dnaLength: 1,
    patternType: "options" as const,
    traitArgs: ["No", "Yes"],
  },
  {
    traitName: "Fingerprint",
    dobType: "String" as const,
    dnaOffset: 0,
    dnaLength: 4,
    patternType: "rawString" as const,
  },
  {
    traitName: "Sealed (Unix)",
    dobType: "Number" as const,
    dnaOffset: 4,
    dnaLength: 4,
    patternType: "rawNumber" as const,
  },
  {
    traitName: "SigAnchor",
    dobType: "String" as const,
    dnaOffset: 12,
    dnaLength: 4,
    patternType: "rawString" as const,
  },
  {
    traitName: "prev.bgcolor",
    dobType: "String" as const,
    dnaOffset: 10,
    dnaLength: 1,
    patternType: "options" as const,
    traitArgs: ["#1D9BF0", "#D4A853", "#9333EA"],
  },
];

export function encodeDna(data: SporeDnaData): Uint8Array {
  const dna = new Uint8Array(DNA_TOTAL_BYTES);
  let offset = 0;

  const fingerprintClean = data.fingerprint.startsWith('0x')
    ? data.fingerprint.slice(2)
    : data.fingerprint.replace('#', '');
  const fingerprintBytes = hexToBytes(fingerprintClean.slice(0, DNA_FINGERPRINT_BYTES * 2).padEnd(DNA_FINGERPRINT_BYTES * 2, '0'));
  dna.set(fingerprintBytes, offset);
  offset += DNA_FINGERPRINT_BYTES;

  const timestampBytes = new Uint8Array(4);
  const view = new DataView(timestampBytes.buffer);
  view.setUint32(0, data.timestamp, true);
  dna.set(timestampBytes, offset);
  offset += DNA_TIMESTAMP_BYTES;

  const contentIdBytes = new Uint8Array(2);
  const idView = new DataView(contentIdBytes.buffer);
  idView.setUint16(0, data.contentId, true);
  dna.set(contentIdBytes, offset);
  offset += DNA_ARTICLE_ID_BYTES;

  dna[offset] = STATUS_CODES[data.status];
  offset += DNA_STATUS_BYTES;

  dna[offset] = data.archived ? 1 : 0;
  offset += DNA_ARCHIVED_BYTES;

  if (data.signatureAnchor) {
    const sigClean = data.signatureAnchor.startsWith('0x')
      ? data.signatureAnchor.slice(2)
      : data.signatureAnchor;
    const sigBytes = hexToBytes(sigClean.slice(0, DNA_SIGNATURE_ANCHOR_BYTES * 2).padEnd(DNA_SIGNATURE_ANCHOR_BYTES * 2, '0'));
    dna.set(sigBytes, offset);
  }

  return dna;
}

export function decodeDna(dna: Uint8Array): SporeDnaData | null {
  if (dna.length < DNA_TOTAL_BYTES) {
    return null;
  }

  let offset = 0;

  const fingerprint = '#' + bytesToHex(dna.slice(offset, offset + DNA_FINGERPRINT_BYTES)).toUpperCase();
  offset += DNA_FINGERPRINT_BYTES;

  const timestampView = new DataView(dna.buffer, dna.byteOffset + offset, DNA_TIMESTAMP_BYTES);
  const timestamp = timestampView.getUint32(0, true);
  offset += DNA_TIMESTAMP_BYTES;

  const contentIdView = new DataView(dna.buffer, dna.byteOffset + offset, DNA_ARTICLE_ID_BYTES);
  const contentId = contentIdView.getUint16(0, true);
  offset += DNA_ARTICLE_ID_BYTES;

  const statusCode = dna[offset];
  const status = STATUS_FROM_CODE[statusCode] || 'standard';
  offset += DNA_STATUS_BYTES;

  const archived = dna[offset] === 1;
  offset += DNA_ARCHIVED_BYTES;

  const signatureAnchor = '0x' + bytesToHex(dna.slice(offset, offset + DNA_SIGNATURE_ANCHOR_BYTES));

  return {
    fingerprint,
    timestamp,
    contentId,
    status,
    archived,
    signatureAnchor,
  };
}

export function encodeDnaToHex(data: SporeDnaData): string {
  const dnaBytes = encodeDna(data);
  return bytesToHex(dnaBytes);
}

export function createDnaData(
  contentHash: string,
  contentId: number,
  status: ContentStatus = 'standard',
  hasArchive: boolean = false
): SporeDnaData {
  const hashClean = contentHash.startsWith('0x') ? contentHash.slice(2) : contentHash;
  return {
    fingerprint: '#' + hashClean.slice(0, 8).toUpperCase(),
    timestamp: Math.floor(Date.now() / 1000),
    contentId,
    status,
    archived: hasArchive,
  };
}

export function createDnaDataWithTimestamp(
  contentHash: string,
  contentId: number,
  status: ContentStatus = 'standard',
  hasArchive: boolean = false,
  timestamp: number = Math.floor(Date.now() / 1000)
): SporeDnaData {
  const hashClean = contentHash.startsWith('0x') ? contentHash.slice(2) : contentHash;
  return {
    fingerprint: '#' + hashClean.slice(0, 8).toUpperCase(),
    timestamp,
    contentId,
    status,
    archived: hasArchive,
  };
}

export function createSealSigningMessage(
  contentHash: string,
  contentId: number,
  authorAddress: string,
  archiveTxId?: string
): string {
  const timestamp = Math.floor(Date.now() / 1000);
  return createSealSigningMessageWithTimestamp(contentHash, contentId, authorAddress, timestamp, archiveTxId);
}

export function createSealSigningMessageWithTimestamp(
  contentHash: string,
  contentId: number,
  authorAddress: string,
  timestamp: number,
  archiveTxId?: string
): string {
  const dateStr = new Date(timestamp * 1000).toISOString();

  let message = `Content Seal\n\n`;
  message += `I am sealing content #${contentId} with my signature.\n\n`;
  message += `Content Hash: ${contentHash}\n`;
  message += `Author: ${authorAddress}\n`;
  message += `Timestamp: ${dateStr}\n`;

  if (archiveTxId) {
    message += `Archive: ${archiveTxId}\n`;
  }

  message += `\nThis signature creates a permanent sealing record.`;

  return message;
}

export function createClusterMetadata(
  description: string = "Content Seals - Permanent on-chain content proofs with signature anchor. Each seal contains fingerprint, timestamp, content ID, status, archive flag, and a 4-byte signature anchor for on-chain verification binding."
): ClusterMetadata {
  return {
    description,
    dob: {
      ver: 0 as const,
      decoder: {
        type: "code_hash" as const,
        hash: "0x13cac78ad8482202f18f9df4ea707611c35f994375fa03ae79121312dda9925c",
      },
      pattern: DOB_PATTERN,
    },
  };
}

export function estimateSealCapacity(): bigint {
  const baseCapacity = BigInt(61) * BigInt(100000000);
  const dnaCapacity = BigInt(DNA_TOTAL_BYTES) * BigInt(100000000) / BigInt(1000);
  const margin = BigInt(1) * BigInt(100000000);
  return baseCapacity + dnaCapacity + margin;
}

export function formatCapacityAsCkb(capacity: bigint): string {
  const ckb = Number(capacity) / 100000000;
  return ckb.toFixed(2);
}

export function formatSealDate(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function validateDnaHex(hex: string): boolean {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length !== DNA_TOTAL_BYTES * 2) {
    return false;
  }
  return /^[0-9a-fA-F]+$/.test(clean);
}

export function createDOBContent(data: SporeDnaData): DOBContent {
  return {
    dna: encodeDnaToHex(data),
  };
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
