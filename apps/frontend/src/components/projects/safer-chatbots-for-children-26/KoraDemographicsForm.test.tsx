import type { KoraDemographicsDto } from "@alliance/shared/client";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test } from "bun:test";
import { useState } from "react";
import { ONBOARDING_COPY } from "./copy";
import {
  EMPTY_DEMOGRAPHICS,
  KoraDemographicsForm,
} from "./KoraDemographicsForm";

let latest: KoraDemographicsDto;

function Harness({
  from = EMPTY_DEMOGRAPHICS,
}: {
  from?: KoraDemographicsDto;
}) {
  const [value, setValue] = useState(from);
  latest = value;
  return (
    <KoraDemographicsForm
      value={value}
      onChange={(next) => {
        latest = next;
        setValue(next);
      }}
    />
  );
}

const renderForm = (from?: KoraDemographicsDto) => {
  latest = from ?? EMPTY_DEMOGRAPHICS;
  return render(<Harness from={from} />);
};

test("starts with nothing chosen, so an unanswered question stays unanswered", () => {
  renderForm();
  for (const radio of screen.getAllByRole("radio")) {
    expect((radio as HTMLInputElement).checked).toBe(false);
  }
  expect(
    screen.queryByRole("button", { name: ONBOARDING_COPY.clear }),
  ).toBeNull();
  expect(latest).toEqual(EMPTY_DEMOGRAPHICS);
});

test("asks which part of the United States only of someone living there", () => {
  renderForm();
  expect(screen.queryByText(ONBOARDING_COPY.usRegion)).toBeNull();

  fireEvent.change(screen.getByLabelText(ONBOARDING_COPY.country), {
    target: { value: "US" },
  });
  fireEvent.click(screen.getByRole("radio", { name: "Midwest" }));
  expect(latest.usRegion).toBe("midwest");

  fireEvent.change(screen.getByLabelText(ONBOARDING_COPY.country), {
    target: { value: "FR" },
  });
  expect(screen.queryByText(ONBOARDING_COPY.usRegion)).toBeNull();
  expect(latest.usRegion).toBeNull();
});

test("asks about children only of a parent, and forgets the answers if they say no", () => {
  renderForm();
  expect(screen.queryByText(ONBOARDING_COPY.childrenAgeBands)).toBeNull();

  const parent = screen.getByRole("group", { name: ONBOARDING_COPY.isParent });
  fireEvent.click(within(parent).getByRole("radio", { name: "Yes" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "10 to 12" }));
  fireEvent.click(screen.getByRole("radio", { name: "Often" }));
  expect(latest.childrenAgeBands).toEqual(["10to12"]);
  expect(latest.childAiUse).toBe("often");

  fireEvent.click(within(parent).getByRole("radio", { name: "No" }));
  expect(screen.queryByText(ONBOARDING_COPY.childrenAgeBands)).toBeNull();
  expect(latest.childrenAgeBands).toEqual([]);
  expect(latest.childAiUse).toBeNull();
});

test("clears an answer the reviewer would rather not give", () => {
  renderForm();
  fireEvent.click(screen.getByRole("radio", { name: "40 to 49" }));
  expect(latest.ageBand).toBe("40to49");

  const age = screen.getByRole("group", { name: ONBOARDING_COPY.age });
  fireEvent.click(
    within(age).getByRole("button", { name: ONBOARDING_COPY.clear }),
  );
  expect(latest.ageBand).toBeNull();
});

test("keeps 'prefer not to say' apart from no answer at all", () => {
  renderForm();
  const gender = screen.getByRole("group", { name: ONBOARDING_COPY.gender });
  fireEvent.click(
    within(gender).getByRole("radio", { name: "Prefer not to say" }),
  );
  expect(latest.gender).toBe("prefer_not_to_say");
  expect(latest.ageBand).toBeNull();
});
