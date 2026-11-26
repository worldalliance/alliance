import type { CohortExpression } from "@alliance/common/cohort-expression";
import { makeTag } from "@alliance/shared/lib/testFixtures";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ToastProvider } from "../../../ui/ToastProvider";
import CohortExpressionBuilder from "./CohortExpressionBuilder";
import { changeNodeType } from "./cohortRules";

const sources = {
  availableTags: [makeTag({ id: "tag-1", name: "non-US" })],
  tagsLoading: false,
  tagsError: false,
  availableActions: [],
  actionsLoading: false,
  actionsError: false,
  availableUsers: [],
  usersLoading: false,
  usersError: false,
};

let latest: CohortExpression | null = null;

function Harness({
  initial,
  emptyHint,
}: {
  initial: CohortExpression | null;
  emptyHint?: string;
}) {
  const [value, setValue] = useState(initial);
  latest = value;
  return (
    <CohortExpressionBuilder
      {...sources}
      value={value}
      onChange={setValue}
      emptyHint={emptyHint}
    />
  );
}

const renderBuilder = (initial: CohortExpression | null, emptyHint?: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <Harness initial={initial} emptyHint={emptyHint} />
      </ToastProvider>
    </QueryClientProvider>,
  );

const typeSelects = () =>
  screen.getAllByRole<HTMLSelectElement>("combobox", {
    name: "Condition type",
  });

describe("CohortExpressionBuilder editing", () => {
  it("says an empty cohort matches no one unless the mount says otherwise", () => {
    renderBuilder(null);
    expect(
      screen.getByText("No conditions, so no members match."),
    ).toBeTruthy();
  });

  it("shows the mount's own hint for an empty cohort", () => {
    renderBuilder(null, "Nobody sees this form.");
    expect(screen.getByText("Nobody sees this form.")).toBeTruthy();
  });

  it("doesn't call an unreadable stored cohort empty or count it", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <CohortExpressionBuilder
            {...sources}
            value={null}
            onChange={() => {}}
            unreadable
          />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/stored cohort couldn.t be read/)).toBeTruthy();
    expect(screen.queryByText(/no members match/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Add condition" })).toBeNull();
    expect(screen.queryByText(/Compare with another task/)).toBeNull();
  });

  it("doesn't paste over an unreadable stored cohort", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <CohortExpressionBuilder
            {...sources}
            value={null}
            onChange={() => {}}
            unreadable
          />
        </ToastProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Copy or paste/ }));
    expect(
      (
        await screen.findByRole("menuitem", { name: "Paste expression" })
      ).getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("moves focus to Add condition after clearing every condition", () => {
    renderBuilder({ type: "Staff" });
    const clear = screen.getByRole("button", { name: "Clear all conditions" });
    clear.focus();
    fireEvent.click(clear);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add condition" }),
    );
  });

  it("starts an empty cohort with a blank tag condition and focuses it", () => {
    renderBuilder(null);
    fireEvent.click(screen.getByRole("button", { name: "Add condition" }));
    expect(latest).toEqual({ type: "Tag", tagId: "" });
    expect(document.activeElement).toBe(typeSelects()[0]);
  });

  it("focuses a new condition, then the next one when a condition is removed", () => {
    renderBuilder({ type: "AND", children: [{ type: "Staff" }] });

    fireEvent.click(screen.getByRole("button", { name: "Add condition" }));
    expect(document.activeElement).toBe(typeSelects()[2]);

    fireEvent.click(
      screen.getByRole("button", { name: "Remove condition: Is staff" }),
    );
    expect(latest).toEqual({
      type: "AND",
      children: [{ type: "Tag", tagId: "" }],
    });
    expect(document.activeElement).toBe(typeSelects()[1]);

    fireEvent.click(
      screen.getByRole("button", { name: "Remove condition: Has tag" }),
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add condition" }),
    );
    expect(screen.getByText(/this group matches no one/)).toBeTruthy();
  });

  it("turns a condition into a group, replacing it with an empty one", () => {
    renderBuilder({ type: "OR", children: [{ type: "Staff" }] });

    fireEvent.change(typeSelects()[1], { target: { value: "NOT" } });

    expect(latest).toEqual({
      type: "OR",
      children: [{ type: "NOT", child: { type: "Tag", tagId: "" } }],
    });
    expect(typeSelects()).toHaveLength(3);
  });

  it("says a failed paste beside the menu instead of in a toast", async () => {
    const readText = jest.fn().mockResolvedValue("not json");
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText },
    });
    try {
      renderBuilder({ type: "Staff" });
      fireEvent.click(screen.getByRole("button", { name: /Copy or paste/ }));
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "Paste expression" }),
      );
      await screen.findByText(
        "Couldn't paste: the clipboard isn't readable or isn't JSON.",
      );
      expect(latest).toEqual({ type: "Staff" });
    } finally {
      if (original) Object.defineProperty(navigator, "clipboard", original);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });
});

describe("changeNodeType", () => {
  it("keeps a group's children when switching between all and any", () => {
    const children: CohortExpression[] = [
      { type: "Staff" },
      { type: "GroupLead" },
    ];
    expect(changeNodeType({ type: "AND", children }, "OR")).toEqual({
      type: "OR",
      children,
    });
  });

  it("keeps the first child when a group becomes a negation", () => {
    expect(
      changeNodeType(
        { type: "OR", children: [{ type: "Staff" }, { type: "GroupLead" }] },
        "NOT",
      ),
    ).toEqual({ type: "NOT", child: { type: "Staff" } });
  });
});
