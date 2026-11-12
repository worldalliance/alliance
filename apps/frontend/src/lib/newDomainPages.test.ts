import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  INVITE_PAGE_PATTERN,
  movesToNewDomain,
  NEW_DOMAIN_PAGE_PATTERNS,
} from "./newDomainPages";

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
      const pattern = entry.match(/^"~\*([^"]+)"\s+\$new_host;$/)?.[1];
      if (!pattern) throw new Error(`unrecognized map entry: ${entry}`);
      return pattern;
    });
  expect(patterns).toEqual(NEW_DOMAIN_PAGE_PATTERNS);
  expect(conf).toMatch(
    /location \/ \{\s+if \(\$static_page_redirect_host\) \{/,
  );
});

it("matches nginx's invite redirect", () => {
  const map = conf.match(/map \$arg_ref \$invite_redirect_host \{([^}]*)\}/);
  expect(map?.[1]?.replace(/\s+/g, " ").trim()).toBe(
    'default $new_host; "" "";',
  );
  expect(
    conf.match(/location ~ (\S+) \{\s+if \(\$invite_redirect_host\)/)?.[1],
  ).toBe(INVITE_PAGE_PATTERN);
});

const onLegacy = (pathname: string, search = "") =>
  movesToNewDomain({ hostname: "staging.worldalliance.org", pathname, search });

it("matches moved pages on the legacy domain and leaves app pages", () => {
  expect(onLegacy("/people")).toBe(true);
  expect(onLegacy("/FAQ/")).toBe(true);
  expect(onLegacy("/progress/some-post")).toBe(true);
  expect(onLegacy("/peoplex")).toBe(false);
  expect(onLegacy("/tasks")).toBe(false);
});

it("matches / and /signup only when they carry an invite code", () => {
  expect(onLegacy("/signup", "?ref=CODE")).toBe(true);
  expect(onLegacy("/", "?ref=CODE")).toBe(true);
  expect(onLegacy("/signup")).toBe(false);
  expect(onLegacy("/signup", "?ref=")).toBe(false);
  expect(onLegacy("/login", "?ref=CODE")).toBe(false);
});

it("moves nothing off the new domain", () => {
  expect(
    movesToNewDomain({
      hostname: "thealliance.org",
      pathname: "/people",
      search: "",
    }),
  ).toBe(false);
  expect(
    movesToNewDomain({
      hostname: "thealliance.org",
      pathname: "/signup",
      search: "?ref=CODE",
    }),
  ).toBe(false);
});
