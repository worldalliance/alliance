import { addProof, mintProof, spendProof } from "./oauth-proof";

describe("addProof", () => {
  it("keeps the newest three flows", () => {
    const [a, b, c, d] = [1, 2, 3, 4].map(() => mintProof().proof);
    let cookie = addProof({ proof: a, presented: undefined });
    for (const proof of [b, c, d]) {
      cookie = addProof({ proof, presented: cookie });
    }
    expect(cookie).toBe([d, c, b].join(","));
  });
});

describe("spendProof", () => {
  const [a, b] = [mintProof(), mintProof()];
  const cookie = addProof({
    proof: b.proof,
    presented: addProof({ proof: a.proof, presented: undefined }),
  });

  it("removes only the matched flow", () => {
    expect(spendProof({ presented: cookie, proofHash: a.proofHash })).toBe(
      b.proof,
    );
  });

  it("leaves nothing once the last flow is spent", () => {
    expect(spendProof({ presented: a.proof, proofHash: a.proofHash })).toBe("");
  });

  it("matches nothing in a missing cookie or for another flow's hash", () => {
    expect(spendProof({ presented: undefined, proofHash: a.proofHash })).toBe(
      null,
    );
    expect(
      spendProof({ presented: cookie, proofHash: mintProof().proofHash }),
    ).toBe(null);
  });
});
