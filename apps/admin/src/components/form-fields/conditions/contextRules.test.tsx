import { UserValueProperty } from "@alliance/common/forms/user-properties";
import type { Condition } from "@alliance/common/forms/visible-if-formula";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent } from "@testing-library/react";
import { latest, renderEditor, rule } from "./conditionEditorTesting";

afterEach(cleanup);
serveApi(
  routes({
    "GET /tasks/listForms": () => Response.json([]),
    "GET /tasks/customValidators": () => Response.json([]),
  }),
);

const editing = (condition: Condition) =>
  renderEditor({ initial: { conditions: { c1: condition }, formula: "c1" } });

it("unchecks one device, keeping the rest in their order", () => {
  editing({ kind: "deviceType", deviceType: ["mobile", "tablet", "desktop"] });
  fireEvent.click(rule("c1").getByRole("checkbox", { name: "Tablet" }));
  expect(latest()?.conditions.c1).toEqual({
    kind: "deviceType",
    deviceType: ["mobile", "desktop"],
  });
});

it("saves a picked contract date as the matching instant", () => {
  editing({
    kind: "firstContractSigned",
    comparison: "before",
    date: "2026-01-01T00:00:00.000Z",
  });
  fireEvent.change(rule("c1").getByLabelText("Date"), {
    target: { value: "2026-03-01T09:30" },
  });
  fireEvent.change(rule("c1").getByRole("combobox", { name: "Signed" }), {
    target: { value: "onOrAfter" },
  });
  expect(latest()?.conditions.c1).toEqual({
    kind: "firstContractSigned",
    comparison: "onOrAfter",
    date: new Date("2026-03-01T09:30").toISOString(),
  });
});

it("saves a completed-action count, ignoring an invalid entry", () => {
  editing({ kind: "completedActionCount", atLeast: 1 });
  const input = rule("c1").getByRole("spinbutton", {
    name: "Completed actions",
  });
  fireEvent.change(input, { target: { value: "-2" } });
  expect(latest()?.conditions.c1).toEqual({
    kind: "completedActionCount",
    atLeast: 1,
  });
  fireEvent.change(input, { target: { value: "4" } });
  expect(latest()?.conditions.c1).toEqual({
    kind: "completedActionCount",
    atLeast: 4,
  });
});

it("switches which user property a rule checks", () => {
  editing({
    kind: "userPropertyHasValue",
    property: UserValueProperty.City,
    hasValue: true,
  });
  const other = Object.values(UserValueProperty).find(
    (property) => property !== UserValueProperty.City,
  );
  fireEvent.change(
    rule("c1").getByRole("combobox", { name: "User property" }),
    {
      target: { value: other },
    },
  );
  expect(latest()?.conditions.c1).toEqual({
    kind: "userPropertyHasValue",
    property: other,
    hasValue: true,
  });
});
