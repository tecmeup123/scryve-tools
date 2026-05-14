import {
  encodeWitness,
  decodeWitness,
  encodeWitnessHex,
  decodeWitnessHex,
  encodeSealWitness,
  decodeSealWitness,
  encodeSealWitnessHex,
  decodeSealWitnessHex,
  encodePaymentReceiptWitness,
  decodePaymentReceiptWitness,
  encodePaymentReceiptWitnessHex,
  decodePaymentReceiptWitnessHex,
  isWitnessHex,
  isWitnessBytes,
  isSealWitnessHex,
  isPaymentReceiptWitnessHex,
  createSealDisplayMessage,
  createPaymentReceiptDisplayMessage,
  DEFAULT_MAGIC,
  DEFAULT_VERSION,
  type SealRecord,
  type PaymentReceiptRecord,
} from "./index";

const sealRecord: SealRecord = {
  contentHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
  contentId: 42,
  authorAddress: "ckb1qz9c7e7uyekl4jcex2rdjqmptzxpexs4h0qlxz4e5qvkrg",
  timestamp: "2024-01-01T00:00:00.000Z",
  contentTitle: "Test Article",
  contentSlug: "test-article",
  contentVersion: 1,
};

const paymentRecord: PaymentReceiptRecord = {
  senderAddress: "ckb1qz9c7e7uyekl4jcex2rdjqmptzxpexs4h0qlxz4e5qvkrg",
  recipientAddress: "ckb1qr9c7e7uyekl4jcex2rdjqmptzxpexs4h0qlxz4e5qvkrg",
  contentId: 42,
  amountCkb: "100.5",
  timestamp: "2024-01-01T00:00:00.000Z",
};

describe("constants", () => {
  it("DEFAULT_MAGIC is 8 bytes", () => {
    expect(new TextEncoder().encode(DEFAULT_MAGIC).length).toBe(8);
  });

  it("DEFAULT_VERSION is 0x01", () => {
    expect(DEFAULT_VERSION).toBe(0x01);
  });
});

describe("encodeWitness / decodeWitness", () => {
  it("round-trips a generic payload", () => {
    const data = { foo: "bar", num: 42 };
    const encoded = encodeWitness(data, "test");
    const decoded = decodeWitness<typeof data>(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.type).toBe("test");
    expect(decoded!.data.foo).toBe("bar");
    expect(decoded!.data.num).toBe(42);
  });

  it("returns null for bytes that don't start with the magic", () => {
    expect(decodeWitness(new Uint8Array([0x00, 0x01, 0x02]))).toBeNull();
  });

  it("preserves custom magic override", () => {
    const encoded = encodeWitness({ x: 1 }, "t", { magic: "MYMGC123" });
    const decoded = decodeWitness({ x: 0 }, { magic: "MYMGC123" });
    expect(decodeWitness<{ x: number }>(encoded, { magic: "MYMGC123" })).not.toBeNull();
    expect(decodeWitness<{ x: number }>(encoded, { magic: DEFAULT_MAGIC })).toBeNull();
  });
});

describe("encodeWitnessHex / decodeWitnessHex", () => {
  it("returns a 0x-prefixed hex string", () => {
    const hex = encodeWitnessHex({ value: 99 }, "mytype");
    expect(hex).toMatch(/^0x[0-9a-f]+$/);
  });

  it("round-trips via hex", () => {
    const hex = encodeWitnessHex({ value: 99 }, "mytype");
    const decoded = decodeWitnessHex<{ value: number }>(hex);
    expect(decoded!.data.value).toBe(99);
  });
});

describe("encodeSealWitness / decodeSealWitness", () => {
  it("round-trips all SealRecord fields", () => {
    const bytes = encodeSealWitness(sealRecord);
    const decoded = decodeSealWitness(bytes);
    expect(decoded).not.toBeNull();
    expect(decoded!.contentHash).toBe(sealRecord.contentHash);
    expect(decoded!.contentId).toBe(sealRecord.contentId);
    expect(decoded!.authorAddress).toBe(sealRecord.authorAddress);
    expect(decoded!.timestamp).toBe(sealRecord.timestamp);
    expect(decoded!.contentTitle).toBe(sealRecord.contentTitle);
    expect(decoded!.contentSlug).toBe(sealRecord.contentSlug);
    expect(decoded!.contentVersion).toBe(sealRecord.contentVersion);
  });

  it("hex variant round-trips", () => {
    const hex = encodeSealWitnessHex(sealRecord);
    const decoded = decodeSealWitnessHex(hex);
    expect(decoded!.contentId).toBe(sealRecord.contentId);
  });
});

describe("encodePaymentReceiptWitness / decodePaymentReceiptWitness", () => {
  it("round-trips all PaymentReceiptRecord fields", () => {
    const bytes = encodePaymentReceiptWitness(paymentRecord);
    const decoded = decodePaymentReceiptWitness(bytes);
    expect(decoded).not.toBeNull();
    expect(decoded!.senderAddress).toBe(paymentRecord.senderAddress);
    expect(decoded!.recipientAddress).toBe(paymentRecord.recipientAddress);
    expect(decoded!.contentId).toBe(paymentRecord.contentId);
    expect(decoded!.amountCkb).toBe(paymentRecord.amountCkb);
    expect(decoded!.timestamp).toBe(paymentRecord.timestamp);
  });

  it("hex variant round-trips", () => {
    const hex = encodePaymentReceiptWitnessHex(paymentRecord);
    const decoded = decodePaymentReceiptWitnessHex(hex);
    expect(decoded!.amountCkb).toBe(paymentRecord.amountCkb);
  });
});

describe("isWitnessHex / isWitnessBytes", () => {
  it("recognises a valid witness hex", () => {
    const hex = encodeWitnessHex({}, "test");
    expect(isWitnessHex(hex)).toBe(true);
  });

  it("rejects a random hex string", () => {
    expect(isWitnessHex("0xdeadbeef")).toBe(false);
  });

  it("recognises valid witness bytes", () => {
    const bytes = encodeWitness({}, "test");
    expect(isWitnessBytes(bytes)).toBe(true);
  });

  it("rejects too-short byte arrays", () => {
    expect(isWitnessBytes(new Uint8Array(3))).toBe(false);
  });
});

describe("isSealWitnessHex / isPaymentReceiptWitnessHex", () => {
  it("correctly classifies seal vs payment witnesses", () => {
    const sealHex = encodeSealWitnessHex(sealRecord);
    const paymentHex = encodePaymentReceiptWitnessHex(paymentRecord);
    expect(isSealWitnessHex(sealHex)).toBe(true);
    expect(isSealWitnessHex(paymentHex)).toBe(false);
    expect(isPaymentReceiptWitnessHex(paymentHex)).toBe(true);
    expect(isPaymentReceiptWitnessHex(sealHex)).toBe(false);
  });
});

describe("display message helpers", () => {
  it("createSealDisplayMessage contains hash, contentId, and author", () => {
    const msg = createSealDisplayMessage(sealRecord);
    expect(msg).toContain(sealRecord.contentHash);
    expect(msg).toContain(String(sealRecord.contentId));
    expect(msg).toContain(sealRecord.authorAddress);
    expect(msg).toContain("CKB blockchain");
  });

  it("createPaymentReceiptDisplayMessage contains amount and addresses", () => {
    const msg = createPaymentReceiptDisplayMessage(paymentRecord);
    expect(msg).toContain(paymentRecord.amountCkb);
    expect(msg).toContain(paymentRecord.senderAddress);
    expect(msg).toContain(paymentRecord.recipientAddress);
  });
});
