import type {
  KoraAdminAbandonedSignupDto,
  KoraAdminParticipantDto,
} from "@alliance/shared/client";
import Papa from "papaparse";
import {
  buildKoraCsv,
  matchesSearch,
  participantMethods,
  ParticipantSort,
  signupsPerDay,
  SortDirection,
  sortParticipants,
} from "./koraParticipants";

const participant = (
  overrides: Partial<KoraAdminParticipantDto>,
): KoraAdminParticipantDto => ({
  id: "p1",
  name: "Ada",
  email: "ada@example.com",
  phoneNumber: null,
  timeZone: null,
  createdAt: "2026-11-02T10:00:00.000Z",
  providers: [],
  ...overrides,
});

const abandoned = (
  overrides: Partial<KoraAdminAbandonedSignupDto>,
): KoraAdminAbandonedSignupDto => ({
  id: "a1",
  channel: "sms",
  destination: "+15555550100",
  provider: null,
  verifiedAt: "2026-11-03T10:00:00.000Z",
  recovered: false,
  ...overrides,
});

test("lists the contact's code method, then connected providers", () => {
  expect(
    participantMethods(participant({ providers: ["google", "apple"] })),
  ).toEqual(["Email code", "Google", "Apple"]);
  expect(
    participantMethods(
      participant({ email: null, phoneNumber: "+15555550100" }),
    ),
  ).toEqual(["SMS code"]);
});

test("search ignores case, and phone formatting when the query is a number", () => {
  expect(matchesSearch(["Ada Lovelace"], "  ada ")).toBe(true);
  expect(matchesSearch(["+15555550100"], "(555) 555-0100")).toBe(true);
  expect(matchesSearch(["Ada Lovelace"], "grace")).toBe(false);
  expect(matchesSearch(["agent7@example.com"], "7 @example")).toBe(false);
  expect(matchesSearch(["anything"], "")).toBe(true);
});

test("sorts by the chosen column in either direction", () => {
  const rows = [
    participant({ id: "b", name: "bea", createdAt: "2026-11-01T00:00:00Z" }),
    participant({ id: "a", name: "Al", createdAt: "2026-11-03T00:00:00Z" }),
  ];
  const ids = (by: ParticipantSort, direction: SortDirection) =>
    sortParticipants(rows, { by, direction }).map((p) => p.id);
  expect(ids(ParticipantSort.Name, SortDirection.Asc)).toEqual(["a", "b"]);
  expect(ids(ParticipantSort.SignedUp, SortDirection.Desc)).toEqual(["a", "b"]);
  expect(ids(ParticipantSort.SignedUp, SortDirection.Asc)).toEqual(["b", "a"]);
});

test("counts signups per UTC day, newest first", () => {
  expect(
    signupsPerDay([
      participant({ createdAt: "2026-11-02T23:30:00-05:00" }),
      participant({ createdAt: "2026-11-03T01:00:00Z" }),
      participant({ createdAt: "2026-11-01T12:00:00Z" }),
    ]),
  ).toEqual([
    { day: "2026-11-03", count: 2 },
    { day: "2026-11-01", count: 1 },
  ]);
});

test("exports participants and abandoned signups with a status, escaping formulas", () => {
  const csv = buildKoraCsv({
    participants: [
      participant({ name: "=HYPERLINK(1)", timeZone: "Europe/Oslo" }),
      participant({
        name: "+SUM(1)",
        email: null,
        phoneNumber: "+15555550100",
      }),
    ],
    abandonedSignups: [
      abandoned({}),
      abandoned({
        channel: "email",
        destination: "back@example.com",
        provider: "google",
        recovered: true,
      }),
    ],
  });
  expect(Papa.parse(csv, { header: true }).data).toEqual([
    {
      Status: "participant",
      Name: "'=HYPERLINK(1)",
      Email: "ada@example.com",
      Phone: "",
      "Sign-in methods": "Email code",
      "Time zone": "Europe/Oslo",
      Date: "2026-11-02T10:00:00.000Z",
    },
    {
      Status: "participant",
      Name: "'+SUM(1)",
      Email: "",
      Phone: "+15555550100",
      "Sign-in methods": "SMS code",
      "Time zone": "",
      Date: "2026-11-02T10:00:00.000Z",
    },
    {
      Status: "abandoned",
      Name: "",
      Email: "",
      Phone: "+15555550100",
      "Sign-in methods": "SMS code",
      "Time zone": "",
      Date: "2026-11-03T10:00:00.000Z",
    },
    {
      Status: "recovered",
      Name: "",
      Email: "back@example.com",
      Phone: "",
      "Sign-in methods": "Google",
      "Time zone": "",
      Date: "2026-11-03T10:00:00.000Z",
    },
  ]);
});
