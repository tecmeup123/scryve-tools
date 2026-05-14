import {
  generateAuthNonce,
  NonceStore,
  createChallengeMessage,
  verifySignature,
  getClient,
  isTestnetAddress,
} from "./index";

// ─── generateAuthNonce ───────────────────────────────────────────────────────

describe("generateAuthNonce", () => {
  it("returns a 64-char lowercase hex string", () => {
    const nonce = generateAuthNonce();
    expect(nonce).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(nonce)).toBe(true);
  });

  it("returns different values on successive calls", () => {
    const a = generateAuthNonce();
    const b = generateAuthNonce();
    expect(a).not.toBe(b);
  });
});

// ─── NonceStore ──────────────────────────────────────────────────────────────

describe("NonceStore", () => {
  it("create returns a 64-char hex nonce", () => {
    const store = new NonceStore({ cleanupIntervalMs: 3_600_000 });
    const nonce = store.create("ckt1qaddress1");
    expect(nonce).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(nonce)).toBe(true);
    store.destroy();
  });

  it("validate returns true for a valid nonce+address pair", () => {
    const store = new NonceStore({ cleanupIntervalMs: 3_600_000 });
    const nonce = store.create("ckt1qaddress1");
    expect(store.validate(nonce, "ckt1qaddress1")).toBe(true);
    store.destroy();
  });

  it("validate returns false for wrong address", () => {
    const store = new NonceStore({ cleanupIntervalMs: 3_600_000 });
    const nonce = store.create("ckt1qaddress1");
    expect(store.validate(nonce, "ckt1qaddress2")).toBe(false);
    store.destroy();
  });

  it("validate returns false after nonce is consumed (single-use)", () => {
    const store = new NonceStore({ cleanupIntervalMs: 3_600_000 });
    const nonce = store.create("ckt1qaddress1");
    store.validate(nonce, "ckt1qaddress1");
    expect(store.validate(nonce, "ckt1qaddress1")).toBe(false);
    store.destroy();
  });

  it("validate returns false for unknown nonce", () => {
    const store = new NonceStore({ cleanupIntervalMs: 3_600_000 });
    expect(store.validate("aabbcc", "ckt1qaddress1")).toBe(false);
    store.destroy();
  });

  it("validate returns false for expired nonce", async () => {
    const store = new NonceStore({ ttlMs: 1, cleanupIntervalMs: 3_600_000 });
    const nonce = store.create("ckt1qaddress1");
    await new Promise((r) => setTimeout(r, 5));
    expect(store.validate(nonce, "ckt1qaddress1")).toBe(false);
    store.destroy();
  });

  it("size reflects created and consumed nonces correctly", () => {
    const store = new NonceStore({ cleanupIntervalMs: 3_600_000 });
    expect(store.size).toBe(0);
    const n1 = store.create("ckt1qaddress1");
    const n2 = store.create("ckt1qaddress2");
    expect(store.size).toBe(2);
    store.validate(n1, "ckt1qaddress1");
    expect(store.size).toBe(1);
    store.validate(n2, "ckt1qaddress2");
    expect(store.size).toBe(0);
    store.destroy();
  });

  it("cleanup removes expired entries", async () => {
    const store = new NonceStore({ ttlMs: 1, cleanupIntervalMs: 3_600_000 });
    store.create("ckt1qaddress1");
    store.create("ckt1qaddress2");
    expect(store.size).toBe(2);
    await new Promise((r) => setTimeout(r, 5));
    store.cleanup();
    expect(store.size).toBe(0);
    store.destroy();
  });

  it("destroy clears the store and stops the timer", () => {
    const store = new NonceStore({ cleanupIntervalMs: 3_600_000 });
    store.create("ckt1qaddress1");
    expect(store.size).toBe(1);
    store.destroy();
    expect(store.size).toBe(0);
  });

  it("evicts oldest nonces when maxEntries is exceeded", () => {
    const store = new NonceStore({
      maxEntries: 2,
      cleanupIntervalMs: 3_600_000,
      maxNoncesPerAddress: 100,
    });
    const n1 = store.create("ckt1qaddress1");
    store.create("ckt1qaddress1");
    expect(store.size).toBe(2);
    store.create("ckt1qaddress1");
    // evictOldest(ceil(2 * 0.1) = 1) removes n1 (the oldest) before inserting n3
    expect(store.validate(n1, "ckt1qaddress1")).toBe(false);
    store.destroy();
  });

  it("rate limiting: after maxNoncesPerAddress calls in window, throws", () => {
    const store = new NonceStore({
      maxNoncesPerAddress: 3,
      rateLimitWindowMs: 60_000,
      cleanupIntervalMs: 3_600_000,
    });
    store.create("ckt1qratelimited");
    store.create("ckt1qratelimited");
    store.create("ckt1qratelimited");
    expect(() => store.create("ckt1qratelimited")).toThrow(
      "Rate limit exceeded"
    );
    store.destroy();
  });

  it("rate limiting: different addresses do not affect each other's limits", () => {
    const store = new NonceStore({
      maxNoncesPerAddress: 2,
      rateLimitWindowMs: 60_000,
      cleanupIntervalMs: 3_600_000,
    });
    store.create("ckt1qaddr_a");
    store.create("ckt1qaddr_a");
    expect(() => store.create("ckt1qaddr_b")).not.toThrow();
    store.destroy();
  });

  it("rate limiting: new window resets the count", async () => {
    const store = new NonceStore({
      maxNoncesPerAddress: 1,
      rateLimitWindowMs: 1,
      cleanupIntervalMs: 3_600_000,
    });
    store.create("ckt1qwindowreset");
    await new Promise((r) => setTimeout(r, 5));
    expect(() => store.create("ckt1qwindowreset")).not.toThrow();
    store.destroy();
  });
});

// ─── createChallengeMessage ──────────────────────────────────────────────────

describe("createChallengeMessage", () => {
  it("returns \"Sign to authenticate: <nonce>\" with default prefix", () => {
    const nonce = "abc123";
    expect(createChallengeMessage(nonce)).toBe("Sign to authenticate: abc123");
  });

  it("returns \"<custom>: <nonce>\" when prefix is provided", () => {
    expect(createChallengeMessage("xyz", { prefix: "Login" })).toBe(
      "Login: xyz"
    );
  });

  it("includes the nonce verbatim in the message", () => {
    const nonce = generateAuthNonce();
    const message = createChallengeMessage(nonce);
    expect(message).toContain(nonce);
  });
});

// ─── verifySignature ─────────────────────────────────────────────────────────

describe("verifySignature", () => {
  it("returns { valid: false, error: \"Missing message or signature\" } when message is empty string", async () => {
    const result = await verifySignature("", { r: "0x1", s: "0x2", v: 27 });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Missing message or signature");
  });

  it("returns { valid: false, error: \"Missing message or signature\" } when signature is null", async () => {
    const result = await verifySignature("some message", null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Missing message or signature");
  });

  it("returns { valid: false, error: \"Invalid signature format\" } when signature is a plain number", async () => {
    const result = await verifySignature("some message", 42);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid signature format");
  });

  it("parses a JSON string signature without throwing a format error", async () => {
    const sigJson = JSON.stringify({ r: "0xdeadbeef", s: "0xdeadbeef", v: 27 });
    const result = await verifySignature("some message", sigJson);
    expect(result.error).not.toBe("Invalid signature format");
  });
});

// ─── getClient ───────────────────────────────────────────────────────────────

describe("getClient", () => {
  it("returns an object for \"mainnet\"", () => {
    const client = getClient("mainnet");
    expect(client).not.toBeNull();
    expect(client).not.toBeUndefined();
    expect(typeof client).toBe("object");
  });

  it("returns an object for \"testnet\"", () => {
    const client = getClient("testnet");
    expect(client).not.toBeNull();
    expect(client).not.toBeUndefined();
    expect(typeof client).toBe("object");
  });

  it("defaults to testnet", () => {
    const defaultClient = getClient();
    const testnetClient = getClient("testnet");
    expect(defaultClient.constructor.name).toBe(testnetClient.constructor.name);
  });
});

// ─── isTestnetAddress ────────────────────────────────────────────────────────

describe("isTestnetAddress", () => {
  it("returns true for addresses starting with \"ckt1\"", () => {
    expect(isTestnetAddress("ckt1qzexampleaddress")).toBe(true);
  });

  it("returns false for addresses starting with \"ckb1\"", () => {
    expect(isTestnetAddress("ckb1qzexampleaddress")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isTestnetAddress("")).toBe(false);
  });
});
