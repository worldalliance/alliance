import type { SuiteSplitDto } from "@alliance/shared/client";
import { screen, within } from "@testing-library/react";
import { expect, it } from "bun:test";
import {
  api,
  manual,
  renderPanel,
  serveLaunchApi,
} from "./SuiteLaunchPanel.testHarness";

serveLaunchApi();

const split = (
  filterExpression: SuiteSplitDto["filterExpression"],
): SuiteSplitDto => ({
  id: 4,
  title: "Letters",
  visibilityMode: "combined",
  filterExpression,
  launched: false,
  arms: [
    { id: 1, actionId: 1, rule: manual([10]), optional: false },
    { id: 2, actionId: 2, rule: null, optional: false },
  ],
});

const splitSection = async () =>
  within(await screen.findByRole("region", { name: "Split Letters" }));

it("counts each arm's members", async () => {
  api.served[1] = { ...api.served[1], cohortExpression: manual([10]) };
  api.splits = [split(null)];
  renderPanel();

  const section = await splitSection();
  expect(section.getByText("reaches 2 members")).toBeTruthy();
  expect(section.getByText("Call: 1 member")).toBeTruthy();
  expect(section.getByText("Write: 1 member")).toBeTruthy();
  expect(section.queryByText(/no arm/)).toBeNull();
});

it("flags members the split reaches who get no arm", async () => {
  api.served[1] = { ...api.served[1], cohortExpression: null };
  api.splits = [split(null)];
  renderPanel();

  expect(
    (await splitSection()).getByText(
      "1 member the split reaches gets no arm: Ana",
    ),
  ).toBeTruthy();
});

it("reaches only the members the split's filter matches", async () => {
  api.served[1] = { ...api.served[1], cohortExpression: null };
  api.splits = [split(manual([11]))];
  renderPanel();

  const section = await splitSection();
  expect(section.getByText("reaches 1 member")).toBeTruthy();
  expect(section.queryByText(/no arm/)).toBeNull();
});

it("says when the suite's splits fail to load", async () => {
  api.splitsFail = true;
  renderPanel();

  expect(
    await screen.findByText("Failed to load the suite's splits."),
  ).toBeTruthy();
});
