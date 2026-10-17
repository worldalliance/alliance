import { expect, test } from "bun:test";
import { seedTables } from "./seed-database";

test("lists quoted and unquoted COPY tables, ignoring other lines", () => {
  const dump = [
    "SET client_encoding = 'UTF8';",
    'COPY public."user" (id, name, "createdAt") FROM stdin;',
    "1\tAda\t2026-01-01 00:00:00+00",
    "\\.",
    "COPY public.action_suite (id, title) FROM stdin;",
    "\\.",
    'COPY public."group" (id) FROM stdin;',
    "-- COPY public.commented (id) FROM stdin;",
  ].join("\n");

  expect(seedTables(dump)).toEqual(["user", "action_suite", "group"]);
});
