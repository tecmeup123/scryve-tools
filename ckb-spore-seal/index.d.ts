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
export declare const DNA_FINGERPRINT_BYTES = 4;
export declare const DNA_TIMESTAMP_BYTES = 4;
export declare const DNA_ARTICLE_ID_BYTES = 2;
export declare const DNA_STATUS_BYTES = 1;
export declare const DNA_ARCHIVED_BYTES = 1;
export declare const DNA_SIGNATURE_ANCHOR_BYTES = 4;
export declare const DNA_TOTAL_BYTES = 16;
export declare const STATUS_CODES: Record<ContentStatus, number>;
export declare const STATUS_FROM_CODE: Record<number, ContentStatus>;
export declare const STATUS_COLORS: Record<ContentStatus, string>;
export declare const STATUS_LABELS: Record<ContentStatus, string>;
export declare const DOB_PATTERN: ({
    traitName: string;
    dobType: "Number";
    dnaOffset: number;
    dnaLength: number;
    patternType: "rawNumber";
    traitArgs?: undefined;
} | {
    traitName: string;
    dobType: "String";
    dnaOffset: number;
    dnaLength: number;
    patternType: "options";
    traitArgs: string[];
} | {
    traitName: string;
    dobType: "String";
    dnaOffset: number;
    dnaLength: number;
    patternType: "rawString";
    traitArgs?: undefined;
})[];
export declare function encodeDna(data: SporeDnaData): Uint8Array;
export declare function decodeDna(dna: Uint8Array): SporeDnaData | null;
export declare function encodeDnaToHex(data: SporeDnaData): string;
export declare function createDnaData(contentHash: string, contentId: number, status?: ContentStatus, hasArchive?: boolean): SporeDnaData;
export declare function createDnaDataWithTimestamp(contentHash: string, contentId: number, status?: ContentStatus, hasArchive?: boolean, timestamp?: number): SporeDnaData;
export declare function createSealSigningMessage(contentHash: string, contentId: number, authorAddress: string, archiveTxId?: string): string;
export declare function createSealSigningMessageWithTimestamp(contentHash: string, contentId: number, authorAddress: string, timestamp: number, archiveTxId?: string): string;
export declare function createClusterMetadata(description?: string): ClusterMetadata;
export declare function estimateSealCapacity(): bigint;
export declare function formatCapacityAsCkb(capacity: bigint): string;
export declare function formatSealDate(unixTimestamp: number): string;
export declare function validateDnaHex(hex: string): boolean;
export declare function createDOBContent(data: SporeDnaData): DOBContent;
//# sourceMappingURL=index.d.ts.map