import { LinkKind, resolveLink } from "./resolve";

test("links resolve relative to the file that contains them", () => {
  const fromPath = "docs/wiki/a.md";
  expect(resolveLink({ fromPath, url: "../provenance/x/" })).toEqual({
    ok: true,
    value: {
      kind: LinkKind.Local,
      path: "docs/provenance/x",
      fragment: undefined,
    },
  });
  expect(resolveLink({ fromPath, url: "#part" })).toEqual({
    ok: true,
    value: { kind: LinkKind.Local, path: fromPath, fragment: "part" },
  });
  expect(resolveLink({ fromPath, url: "./my%20page.md#" })).toEqual({
    ok: true,
    value: {
      kind: LinkKind.Local,
      path: "docs/wiki/my page.md",
      fragment: undefined,
    },
  });
  expect(resolveLink({ fromPath, url: "mailto:x@example.com" })).toEqual({
    ok: true,
    value: { kind: LinkKind.External, url: "mailto:x@example.com" },
  });
  expect(resolveLink({ fromPath, url: "a.md?plain=1#L3" })).toEqual({
    ok: false,
    error: 'remove the query string from "a.md?plain=1#L3"',
  });
  expect(resolveLink({ fromPath, url: "b.md#caf%C3%A9" })).toEqual({
    ok: true,
    value: { kind: LinkKind.Local, path: "docs/wiki/b.md", fragment: "café" },
  });
  expect(resolveLink({ fromPath, url: "b.md#%zz" })).toEqual({
    ok: false,
    error: 'malformed percent-encoding in "b.md#%zz"',
  });
  expect(resolveLink({ fromPath, url: "../../../x.md" })).toEqual({
    ok: false,
    error: '"../../../x.md" points outside the repository',
  });
  expect(resolveLink({ fromPath, url: "/docs/x.md" })).toEqual({
    ok: false,
    error: 'use a relative path instead of "/docs/x.md"',
  });
  expect(resolveLink({ fromPath, url: "bad%zz.md" })).toEqual({
    ok: false,
    error: 'malformed percent-encoding in "bad%zz.md"',
  });
});
