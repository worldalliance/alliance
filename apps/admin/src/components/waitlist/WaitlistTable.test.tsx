import type { AdminWaitlistEntryDto } from "@alliance/shared/client/types.gen";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import WaitlistTable from "./WaitlistTable";

const entry: AdminWaitlistEntryDto = {
  id: 1,
  name: "Test Person",
  email: "person@example.com",
  phoneNumber: null,
  reason: null,
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

afterEach(cleanup);

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
  render(
    <ToastProvider>
      <WaitlistTable
        entries={[
          { ...entry, contractEvents: events },
          { ...entry, id: 2, name: "Waiting Person", inviteState: "unused" },
          { ...entry, id: 3, name: "Unsigned Person" },
        ]}
        selectedIds={new Set()}
        onSelectedIdsChange={() => {}}
        onDeselect={() => {}}
        selectable
        sort="joined_desc"
        onSortChange={() => {}}
        onFilterReferrer={() => {}}
      />
    </ToastProvider>,
    queryWrapper(),
  );
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
        `${event.type === "signed" ? "Signed" : "Suspended"} · ${formatDateTime(new Date(event.date))}`,
    ),
  );
  for (const row of rows.slice(1))
    expect(within(row).getAllByRole("cell")[contractIndex].textContent).toBe(
      "No contract events",
    );
});

it("shows a phone entry's number for display", () => {
  render(
    <ToastProvider>
      <WaitlistTable
        entries={[{ ...entry, email: null, phoneNumber: "+14155552671" }]}
        selectedIds={new Set()}
        onSelectedIdsChange={() => {}}
        onDeselect={() => {}}
        selectable
        sort="joined_desc"
        onSortChange={() => {}}
        onFilterReferrer={() => {}}
      />
    </ToastProvider>,
    queryWrapper(),
  );
  expect(screen.getByText("(415) 555-2671")).toBeTruthy();
});
