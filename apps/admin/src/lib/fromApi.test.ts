import { R } from "@alliance/common/result";
import { describe, expect, it } from "bun:test";
import { adminRefusalMessage } from "./adminRefusal";
import { fromApi } from "./fromApi";

const refusal = { statusCode: 409, message: "That slug is taken." };

describe("fromApi", () => {
  it("passes a success through", async () => {
    expect(await fromApi(Promise.resolve(1))).toEqual(R.success(1));
  });

  it("lets the server's 4xx message reach the reader", async () => {
    const result = await fromApi(Promise.reject(refusal));
    expect(!result.ok && adminRefusalMessage(result.error, "Failed")).toBe(
      "That slug is taken.",
    );
  });

  it("is what R.fromPromise alone loses", async () => {
    const result = await R.fromPromise(Promise.reject(refusal));
    expect(!result.ok && adminRefusalMessage(result.error, "Failed")).toBe(
      "Failed",
    );
  });
});
