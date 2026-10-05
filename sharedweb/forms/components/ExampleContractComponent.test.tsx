import type { ContractEventDto } from "@alliance/shared/client";
import { formatShortDate } from "@alliance/shared/lib/dateFormatters";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { cleanup, render, screen } from "@testing-library/react";
import ExampleContractComponent from "./ExampleContractComponent";

afterEach(cleanup);

const event = (
  type: ContractEventDto["type"],
  date: string,
): ContractEventDto => ({ type, date, automatic: false, contractId: null });

const firstSigned = event("signed", "2026-01-10T12:00:00Z");
const suspended = event("suspended", "2026-02-10T12:00:00Z");
const reSigned = event("signed", "2026-03-10T12:00:00Z");

it.each([
  [
    "the current signing",
    reSigned,
    `Your contract was signed on: ${formatShortDate(new Date(reSigned.date))}`,
  ],
  ["no signing while suspended", suspended, "No contract on file"],
])("shows %s", (_, lastContractEvent, text) => {
  render(
    <ExampleContractComponent
      field={{
        id: "contract",
        type: "input",
        kind: "custom",
        label: "Contract",
        componentId: "example-contract",
      }}
      user={makeUser({
        contractEvents: [firstSigned, suspended, reSigned],
        lastContractEvent,
      })}
      value={null}
      onChange={() => {}}
    />,
  );

  expect(
    screen.getByText((_, el) => el?.tagName === "P" && el.textContent === text),
  ).toBeTruthy();
});
