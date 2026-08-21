import { isDeployed, NodeEnv, parseNodeEnv } from "./node-env";

describe("parseNodeEnv", () => {
  it.each(Object.values(NodeEnv))("recognizes %s", (value) => {
    expect(parseNodeEnv(value)).toEqual({ ok: true, value });
  });

  // CORS and database selection require exact values rather than near matches.
  it.each([undefined, "", "prod", "PRODUCTION", "development ", "qa"])(
    "fails for %p",
    (value) => {
      expect(parseNodeEnv(value).ok).toBe(false);
    },
  );

  it("names the value and the accepted set", () => {
    const parsed = parseNodeEnv("qa");

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.message).toBe(
      "NODE_ENV=qa (expected one of production, staging, development, test)",
    );
  });

  it("says <unset> rather than undefined", () => {
    const parsed = parseNodeEnv(undefined);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.message).toContain("NODE_ENV=<unset>");
  });
});

describe("isDeployed", () => {
  it.each([NodeEnv.Production, NodeEnv.Staging])("is true for %s", (env) => {
    expect(isDeployed(env)).toBe(true);
  });

  it.each([NodeEnv.Development, NodeEnv.Test])("is false for %s", (env) => {
    expect(isDeployed(env)).toBe(false);
  });
});
