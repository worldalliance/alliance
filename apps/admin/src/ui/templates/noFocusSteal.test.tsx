import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { Input } from "../Input";
import { FieldGroup } from "./Form";
import { ContentState } from "./States";

afterEach(cleanup);

it("leaves focus where it is when a FieldGroup's error or a load error appears", () => {
  const { rerender } = render(
    <>
      <button type="button">elsewhere</button>
      <FieldGroup label="Suites">
        <Input aria-label="first" />
      </FieldGroup>
      <ContentState loading skeleton={null} errorTitle="Couldn't load x">
        body
      </ContentState>
    </>,
  );
  const elsewhere = screen.getByRole("button", { name: "elsewhere" });
  elsewhere.focus();
  rerender(
    <>
      <button type="button">elsewhere</button>
      <FieldGroup label="Suites" error="Pick one.">
        <Input aria-label="first" />
      </FieldGroup>
      <ContentState
        loading={false}
        error="Server said no"
        skeleton={null}
        errorTitle="Couldn't load x"
        onRetry={() => {}}
      >
        body
      </ContentState>
    </>,
  );
  expect(screen.getAllByRole("alert")).toHaveLength(2);
  expect(document.activeElement).toBe(elsewhere);
});
