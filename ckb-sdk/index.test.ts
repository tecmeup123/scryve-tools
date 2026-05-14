import * as sdk from "./index";

describe("ckb-sdk re-exports", () => {
  it("exports walletAuth namespace with core functions", () => {
    expect(sdk.walletAuth).toBeDefined();
    expect(typeof sdk.walletAuth.generateAuthNonce).toBe("function");
    expect(typeof sdk.walletAuth.createChallengeMessage).toBe("function");
    expect(typeof sdk.walletAuth.verifySignature).toBe("function");
    expect(typeof sdk.walletAuth.deriveAddress).toBe("function");
    expect(typeof sdk.walletAuth.NonceStore).toBe("function");
  });

  it("exports witnessData namespace with core functions", () => {
    expect(sdk.witnessData).toBeDefined();
    expect(typeof sdk.witnessData.encodeWitness).toBe("function");
    expect(typeof sdk.witnessData.decodeWitness).toBe("function");
  });

  it("exports sporeSeal namespace with core functions", () => {
    expect(sdk.sporeSeal).toBeDefined();
    expect(typeof sdk.sporeSeal.encodeDna).toBe("function");
    expect(typeof sdk.sporeSeal.decodeDna).toBe("function");
  });

  it("exports paymentSplit namespace with core functions", () => {
    expect(sdk.paymentSplit).toBeDefined();
    expect(typeof sdk.paymentSplit.calculateSplit).toBe("function");
    expect(typeof sdk.paymentSplit.calculateDynamicSplit).toBe("function");
    expect(typeof sdk.paymentSplit.calculateMinCellCapacity).toBe("function");
  });

  it("exports xudtPayment namespace with core functions", () => {
    expect(sdk.xudtPayment).toBeDefined();
    expect(typeof sdk.xudtPayment.encodeXudtAmount).toBe("function");
    expect(typeof sdk.xudtPayment.fetchXudtPriceUsd).toBe("function");
    expect(typeof sdk.xudtPayment.applySlippageBps).toBe("function");
    expect(sdk.xudtPayment.BEAF).toBeDefined();
  });
});
