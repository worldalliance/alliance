import {
  signedContractEvent,
  suspendedContractEvent,
} from "@alliance/shared/lib/contract";
import { makeProfile } from "@alliance/shared/lib/testFixtures";
import { render, screen } from "@testing-library/react";
import { expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import CommunityMembersTable, {
  ContractFilterMode,
  matchesContractFilter,
} from "./CommunityMembersTable";
import { ToastProvider } from "./ToastProvider";

const members = {
  signed: {
    lastContractEvent: signedContractEvent({ contractId: 1, date: "d" }),
  },
  suspended: { lastContractEvent: suspendedContractEvent("d") },
  none: {},
};

it.each([
  [ContractFilterMode.ALL, ["signed", "suspended", "none"]],
  [ContractFilterMode.SIGNED, ["signed"]],
  [ContractFilterMode.SUSPENDED, ["suspended"]],
  [ContractFilterMode.NOT_SIGNED, ["none"]],
])("the %s contract filter matches %j", (mode, expected) => {
  expect(
    Object.entries(members)
      .filter(([, member]) => matchesContractFilter(mode, member))
      .map(([name]) => name),
  ).toEqual(expected);
});

const common = {
  members: [makeProfile(1), makeProfile(2)],
  amLeader: false,
  actions: [],
  maxActionsPerWeek: null,
  memberHref: (id: number) => `/member/${id}`,
};

it("leaves out the heading and filters when the caller filters", () => {
  render(
    <MemoryRouter>
      <ToastProvider>
        <CommunityMembersTable
          {...common}
          leaders={[]}
          showMembersHeading={false}
        />
      </ToastProvider>
    </MemoryRouter>,
  );

  expect(screen.queryByText("Members")).toBeNull();
  expect(screen.queryAllByText("Any status")).toEqual([]);
  expect(screen.getByText("User 1")).toBeTruthy();
  expect(screen.getByText("User 2")).toBeTruthy();
});

it("shows the heading and its completion filter by default", () => {
  render(
    <MemoryRouter>
      <ToastProvider>
        <CommunityMembersTable {...common} leaders={[]} />
      </ToastProvider>
    </MemoryRouter>,
  );

  expect(screen.getByText("Members")).toBeTruthy();
  expect(screen.getAllByText("Any status").length).toBeGreaterThan(0);
});

// @ts-expect-error The caller filters, so there is no contract filter to show.
<CommunityMembersTable
  {...common}
  leaders={[]}
  showMembersHeading={false}
  showContractFilter
/>;
// @ts-expect-error Without the heading, leaders would run into the members.
<CommunityMembersTable
  {...common}
  leaders={[makeProfile(3)]}
  showMembersHeading={false}
/>;
