import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALT_DOMAIN_PAGE_PATTERNS,
  INVITE_PAGE_PATTERN,
  movesToAltDomain,
} from "./altDomainPages";

const conf = readFileSync(
  join(import.meta.dir, "../../../../deploy/nginx/alliance.conf"),
  "utf8",
);

it("lists the same paths as nginx's static page redirect map", () => {
  const map = conf.match(/map \$uri \$static_page_redirect_host \{([^}]*)\}/);
  if (!map?.[1]) throw new Error("static page redirect map not found");
  const patterns = map[1]
    .split("\n")
    .map((line) => line.replace(/#.*/, "").trim())
    .filter((line) => line && line !== 'default "";')
    .map((entry) => {
      const pattern = entry.match(/^"~\*([^"]+)"\s+\$alt_host;$/)?.[1];
      if (!pattern) throw new Error(`unrecognized map entry: ${entry}`);
      return pattern;
    });
  expect(patterns).toEqual(ALT_DOMAIN_PAGE_PATTERNS);
  expect(conf).toMatch(
    /location \/ \{\s+if \(\$static_page_redirect_host\) \{/,
  );
});

it("matches nginx's invite redirect", () => {
  const map = conf.match(/map \$arg_ref \$invite_redirect_host \{([^}]*)\}/);
  expect(map?.[1]?.replace(/\s+/g, " ").trim()).toBe(
    'default $alt_host; "" "";',
  );
  expect(
    conf.match(/location ~ (\S+) \{\s+if \(\$invite_redirect_host\)/)?.[1],
  ).toBe(INVITE_PAGE_PATTERN);
});

const onPrimary = (pathname: string, search = "") =>
  movesToAltDomain({ hostname: "staging.worldalliance.org", pathname, search });

it("matches moved pages on the primary domain and leaves app pages", () => {
  expect(onPrimary("/people")).toBe(true);
  expect(onPrimary("/FAQ/")).toBe(true);
  expect(onPrimary("/progress/some-post")).toBe(true);
  expect(onPrimary("/peoplex")).toBe(false);
  expect(onPrimary("/tasks")).toBe(false);
});

it("matches / and /signup only when they carry an invite code", () => {
  expect(onPrimary("/signup", "?ref=CODE")).toBe(true);
  expect(onPrimary("/", "?ref=CODE")).toBe(true);
  expect(onPrimary("/signup")).toBe(false);
  expect(onPrimary("/signup", "?ref=")).toBe(false);
  expect(onPrimary("/login", "?ref=CODE")).toBe(false);
});

it("moves nothing off the alt domain", () => {
  expect(
    movesToAltDomain({
      hostname: "thealliance.org",
      pathname: "/people",
      search: "",
    }),
  ).toBe(false);
  expect(
    movesToAltDomain({
      hostname: "thealliance.org",
      pathname: "/signup",
      search: "?ref=CODE",
    }),
  ).toBe(false);
});
