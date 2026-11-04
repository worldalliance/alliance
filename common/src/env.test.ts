import { describe, expect, it } from "bun:test";
import { z } from "zod";
import {
  envFlag,
  envWithFallback,
  formatEnvProblems,
  httpUrl,
  optionalEnv,
  parseEnv,
  readEnvKey,
  requireEnvKey,
  requiredEnv,
} from "./env";

describe("readEnvKey", () => {
  const fields = {
    PORT: optionalEnv(z.coerce.number().int()),
    NAME: requiredEnv(z.string()),
  };

  it("treats an empty value as unset", () => {
    expect(readEnvKey({ fields, key: "PORT", source: { PORT: "" } })).toBe(
      undefined,
    );
  });

  it("throws naming a missing required key", () => {
    expect(() => readEnvKey({ fields, key: "NAME", source: {} })).toThrow(
      "Invalid environment: NAME: missing",
    );
  });

  it("throws naming a required key set to an empty value", () => {
    expect(() =>
      readEnvKey({ fields, key: "NAME", source: { NAME: "" } }),
    ).toThrow("Invalid environment: NAME: missing");
  });

  it("treats a whitespace-only value as unset", () => {
    expect(readEnvKey({ fields, key: "PORT", source: { PORT: "  " } })).toBe(
      undefined,
    );
  });

  it("throws naming a required key set to only whitespace", () => {
    expect(() =>
      readEnvKey({ fields, key: "NAME", source: { NAME: "  " } }),
    ).toThrow("Invalid environment: NAME: missing");
  });

  it("throws naming a required key that parses to an empty list", () => {
    expect(() =>
      readEnvKey({
        fields: {
          LIST: requiredEnv(
            z.string().transform((v) => v.split(",").filter(Boolean)),
          ),
        },
        key: "LIST",
        source: { LIST: "," },
      }),
    ).toThrow("Invalid environment: LIST: missing");
  });

  it("throws naming a malformed key without calling it missing", () => {
    expect(() =>
      readEnvKey({ fields, key: "PORT", source: { PORT: "x" } }),
    ).toThrow(/^Invalid environment: PORT: (?!missing)/);
  });
});

describe("requireEnvKey", () => {
  const fields = {
    PORT: optionalEnv(z.coerce.number().int()),
    LIST: optionalEnv(
      z.string().transform((v) => v.split(",").filter(Boolean)),
    ),
  };

  it("returns a set value", () => {
    expect(requireEnvKey({ fields, key: "PORT", source: { PORT: "1" } })).toBe(
      1,
    );
  });

  it("throws naming an unset key", () => {
    expect(() =>
      requireEnvKey({ fields, key: "PORT", source: { PORT: "" } }),
    ).toThrow("Invalid environment: PORT: missing");
  });

  it("throws naming a key set to only whitespace", () => {
    expect(() =>
      requireEnvKey({
        fields: { NAME: optionalEnv(z.string().trim()) },
        key: "NAME",
        source: { NAME: "   " },
      }),
    ).toThrow("Invalid environment: NAME: missing");
  });

  it("throws naming a key set to an empty list", () => {
    expect(() =>
      requireEnvKey({ fields, key: "LIST", source: { LIST: "," } }),
    ).toThrow("Invalid environment: LIST: missing");
  });
});

describe("httpUrl", () => {
  it.each([
    ["http://localhost:7273", true],
    ["https://alliance.test/events/", true],
    ["localhost:7273", false],
    ["ftp://alliance.test", false],
  ])("reads %p as valid: %p", (raw, valid) => {
    expect(httpUrl.safeParse(raw).success).toBe(valid);
  });
});

describe("envFlag", () => {
  it.each([
    ["1", true],
    ["true", true],
    ["0", false],
    ["false", false],
    ["", false],
    [undefined, false],
  ])("reads %p as %p", (raw, expected) => {
    expect(envFlag.parse(raw)).toBe(expected);
  });

  it("rejects anything else", () => {
    expect(envFlag.safeParse("yes").success).toBe(false);
  });
});

describe("parseEnv", () => {
  const fields = {
    LIST: optionalEnv(
      z.string().transform((v) => v.split(",").filter(Boolean)),
    ),
    PORT: optionalEnv(z.coerce.number().int()),
  };
  const requiredKeys = () => ["LIST", "LIST"] as const;
  const problems = (source: Record<string, string>) => {
    const parsed = parseEnv({ fields, source, requiredKeys });
    return parsed.ok ? [] : parsed.error;
  };

  it("reports a required key once, and an empty list as missing", () => {
    expect(problems({})).toEqual(["LIST: missing"]);
    expect(problems({ LIST: "," })).toEqual(["LIST: missing"]);
  });

  it("reports a required key with a default as missing when unset", () => {
    const parsed = parseEnv({
      fields: {
        REGION: optionalEnv(z.string()).transform((v) => v ?? "us-west-2"),
      },
      source: { REGION: " " },
      requiredKeys: () => ["REGION"],
    });
    expect(parsed.ok ? [] : parsed.error).toEqual(["REGION: missing"]);
  });

  it("reports a missing required key beside a malformed field", () => {
    const [port, list] = problems({ PORT: "x" });
    expect(port).toStartWith("PORT: ");
    expect(port).not.toBe("PORT: missing");
    expect(list).toBe("LIST: missing");
  });

  it("reports a malformed required key once, as malformed", () => {
    const parsed = parseEnv({
      fields,
      source: { PORT: "x" },
      requiredKeys: () => ["PORT"],
    });
    const [port, ...rest] = parsed.ok ? [] : parsed.error;
    expect(port).toStartWith("PORT: ");
    expect(port).not.toBe("PORT: missing");
    expect(rest).toEqual([]);
  });

  it("asks for required keys with only the fields that parsed", () => {
    const seen: unknown[] = [];
    parseEnv({
      fields,
      source: { LIST: "a", PORT: "x" },
      requiredKeys: (config) => {
        seen.push(config);
        return [];
      },
    });
    expect(seen).toEqual([{ LIST: ["a"] }]);
  });

  it("returns the parsed config", () => {
    const parsed = parseEnv({ fields, source: { LIST: "a,b" }, requiredKeys });
    expect(parsed.ok && parsed.value.LIST).toEqual(["a", "b"]);
  });

  it("parses each field once", () => {
    let calls = 0;
    const counted = {
      A: optionalEnv(z.string().transform((v) => `${v}${++calls}`)),
    };
    const parsed = parseEnv({ fields: counted, source: { A: "a" } });
    expect(parsed.ok && parsed.value.A).toBe("a1");
  });
});

describe("envWithFallback", () => {
  it("prefers a set source value, letting a blank one fall through and keeping one only it sets", () => {
    expect(
      envWithFallback({
        source: { A: "set", B: " ", C: undefined, E: "e" },
        fallback: { A: "a", B: "b", C: "c", D: "d" },
      }),
    ).toEqual({ A: "set", B: "b", C: "c", D: "d", E: "e" });
  });
});

describe("formatEnvProblems", () => {
  it("indents one problem per line under the heading", () => {
    expect(
      formatEnvProblems({ heading: "Bad", problems: ["A: missing", "B: x"] }),
    ).toBe("Bad:\n  A: missing\n  B: x");
  });
});
