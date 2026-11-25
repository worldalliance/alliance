import type { AdminWaitlistEntryDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { render, screen, within } from "@testing-library/react";
import { expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import { formatDateTime } from "../../lib/formatDate";
import { ToastProvider } from "../../ui/ToastProvider";
import { EntriesTable } from "./EntriesTable";

const renderTable = (entries: AdminWaitlistEntryDto[]) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <EntriesTable
          entries={entries}
          selected={new Set()}
          onSelectedChange={() => {}}
          selectable
          sort="joined_desc"
          onSortChange={() => {}}
          onFilterReferrer={() => {}}
          onOpen={() => {}}
          onSpamChanged={() => {}}
          onWriting={() => () => {}}
          focusRow={() => ({})}
          onFailure={() => {}}
        />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

const entry: AdminWaitlistEntryDto = {
  id: 1,
  name: "Test Person",
  email: "person@example.com",
  phoneNumber: null,
  shareCode: "share1",
  reason: null,
  nonprofitNominations: "Example Foundation\nhttps://example.org",
  organization: null,
  sourceLink: null,
  referrer: null,
  createdAt: "2026-09-01T12:00:00.000Z",
  mobilizedAt: null,
  unsubscribedAt: null,
  spamStatus: "clean",
  inviteState: "claimed",
  tags: [],
  contractEvents: [],
};

it("shows account creation and every dated signing and suspension", () => {
  const events: AdminWaitlistEntryDto["contractEvents"] = [
    {
      type: "suspended",
      date: "2026-09-04T12:00:00.000Z",
      automatic: true,
      contractId: null,
    },
    {
      type: "signed",
      date: "2026-09-03T12:00:00.000Z",
      automatic: false,
      contractId: 1,
    },
    {
      type: "suspended",
      date: "2026-09-02T12:00:00.000Z",
      automatic: false,
      contractId: null,
    },
    {
      type: "signed",
      date: "2026-09-01T12:00:00.000Z",
      automatic: false,
      contractId: 1,
    },
  ];
  renderTable([
    { ...entry, contractEvents: events },
    { ...entry, id: 2, name: "Waiting Person", inviteState: "unused" },
    { ...entry, id: 3, name: "Unsigned Person" },
  ]);
  expect(
    screen.getByRole("columnheader", { name: "Nonprofit nominations" }),
  ).toBeTruthy();
  expect(
    screen.getAllByText("Example Foundation https://example.org"),
  ).toHaveLength(3);
  const headers = screen.getAllByRole("columnheader");
  const accountIndex = headers.findIndex(
    (header) => header.textContent === "Account created",
  );
  const contractIndex = headers.findIndex(
    (header) => header.textContent === "Contract history",
  );
  expect(accountIndex).toBeGreaterThan(-1);
  expect(contractIndex).toBeGreaterThan(-1);
  const rows = screen.getAllByRole("row").slice(1);
  expect(within(rows[0]).getAllByRole("cell")[accountIndex].textContent).toBe(
    "Yes",
  );
  expect(within(rows[1]).getAllByRole("cell")[accountIndex].textContent).toBe(
    "No",
  );
  expect(within(rows[2]).getAllByRole("cell")[accountIndex].textContent).toBe(
    "Yes",
  );
  expect(
    within(rows[0])
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(
    events.map(
      (event) =>
        `${event.type === "signed" ? "Signed" : "Suspended"} · ${formatDateTime(event.date)}`,
    ),
  );
  for (const row of rows.slice(1))
    expect(within(row).getAllByRole("cell")[contractIndex].textContent).toBe(
      "No contract events",
    );
});

it("shows a phone entry's number for display", () => {
  renderTable([{ ...entry, email: null, phoneNumber: "+14155552671" }]);
  expect(screen.getByText("(415) 555-2671")).toBeTruthy();
});
