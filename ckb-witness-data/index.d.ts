export declare const DEFAULT_MAGIC = "WITNESHQ";
export declare const DEFAULT_VERSION = 1;
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
export declare function encodeWitness<T>(data: T, type: string, options?: WitnessOptions): Uint8Array;
export declare function encodeWitnessHex<T>(data: T, type: string, options?: WitnessOptions): string;
export declare function decodeWitness<T>(bytes: Uint8Array, options?: {
    magic?: string;
}): WitnessPayload<T> | null;
export declare function decodeWitnessHex<T>(hex: string, options?: {
    magic?: string;
}): WitnessPayload<T> | null;
export declare function isWitnessHex(hex: string, magic?: string): boolean;
export declare function isWitnessBytes(bytes: Uint8Array, magic?: string): boolean;
export declare function encodeSealWitness(data: SealRecord, options?: WitnessOptions): Uint8Array;
export declare function encodeSealWitnessHex(data: SealRecord, options?: WitnessOptions): string;
export declare function decodeSealWitness(bytes: Uint8Array, options?: {
    magic?: string;
}): SealRecord | null;
export declare function decodeSealWitnessHex(hex: string, options?: {
    magic?: string;
}): SealRecord | null;
export declare function isSealWitnessHex(hex: string, magic?: string): boolean;
export declare function encodePaymentReceiptWitness(data: PaymentReceiptRecord, options?: WitnessOptions): Uint8Array;
export declare function encodePaymentReceiptWitnessHex(data: PaymentReceiptRecord, options?: WitnessOptions): string;
export declare function decodePaymentReceiptWitness(bytes: Uint8Array, options?: {
    magic?: string;
}): PaymentReceiptRecord | null;
export declare function decodePaymentReceiptWitnessHex(hex: string, options?: {
    magic?: string;
}): PaymentReceiptRecord | null;
export declare function isPaymentReceiptWitnessHex(hex: string, magic?: string): boolean;
export declare function createSealDisplayMessage(data: SealRecord): string;
export declare function createPaymentReceiptDisplayMessage(data: PaymentReceiptRecord): string;
//# sourceMappingURL=index.d.ts.map