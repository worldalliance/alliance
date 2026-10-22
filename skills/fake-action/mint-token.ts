import { mintAccessToken } from "../../scripts/lib/access-token";

const userId = Number(process.argv[2]);
if (!Number.isInteger(userId)) {
  throw new Error("usage: bun skills/fake-action/mint-token.ts <userId>");
}
console.log(mintAccessToken(userId));
