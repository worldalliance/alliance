import type { CustomComponentField } from "@alliance/common/forms/form-schema";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, mock } from "bun:test";
import { shareInfoPubliclyToggle } from "../lib/copy";
import { useShareInfoPubliclyToggle } from "./useShareInfoPubliclyToggle";

afterEach(cleanup);

const field: CustomComponentField = {
  id: "share-info",
  type: "input",
  kind: "custom",
  label: "",
  componentId: "share-info-publicly-toggle",
};

type Props = {
  value: string | null;
  user?: { shareInfoPublicly: boolean; anonymous: boolean };
  disabled?: boolean;
  field?: CustomComponentField;
};

function setup(initial: Props) {
  const onChange = mock();
  const hook = renderHook(
    (props: Props) => useShareInfoPubliclyToggle({ field, onChange, ...props }),
    { initialProps: initial },
  );
  return { onChange, ...hook };
}

const sharing = { shareInfoPublicly: true, anonymous: false };
const notSharing = { shareInfoPublicly: false, anonymous: false };

it("seeds an empty answer from the user's preference", () => {
  const { onChange, result } = setup({ value: null, user: sharing });
  expect(onChange).toHaveBeenCalledWith("true");
  expect(result.current.value).toBe(true);
});

it("seeds an empty answer from the fallback without a preference", () => {
  const { onChange } = setup({ value: null });
  expect(onChange).toHaveBeenCalledWith(
    String(shareInfoPubliclyToggle.fallbackDefault),
  );
});

it("keeps a saved answer that differs from the preference", () => {
  const { onChange, result } = setup({ value: "false", user: sharing });
  expect(onChange).not.toHaveBeenCalled();
  expect(result.current.value).toBe(false);
});

it("follows a changed preference until the user toggles", () => {
  const { onChange, result, rerender } = setup({ value: null, user: sharing });
  rerender({ value: "true", user: notSharing });
  expect(onChange).toHaveBeenLastCalledWith("false");

  act(() => result.current.toggle(true));
  onChange.mockClear();
  rerender({ value: "true", user: sharing });
  rerender({ value: "true", user: notSharing });
  expect(onChange).not.toHaveBeenCalled();
});

it("leaves the answer alone while disabled", () => {
  const { onChange } = setup({ value: null, user: sharing, disabled: true });
  expect(onChange).not.toHaveBeenCalled();
});

it("disables the toggle for an anonymous user", () => {
  const { result } = setup({
    value: "false",
    user: { shareInfoPublicly: false, anonymous: true },
  });
  expect(result.current.disabled).toBe(true);
});

it("falls back to the default label and description", () => {
  const { result } = setup({ value: "false" });
  expect(result.current.label).toBe(shareInfoPubliclyToggle.defaultLabel);
  expect(result.current.description).toBe(
    shareInfoPubliclyToggle.defaultDescription,
  );
});

it("uses the field's own label and description", () => {
  const { result } = setup({
    value: "false",
    field: { ...field, label: "Custom", description: "Desc" },
  });
  expect(result.current.label).toBe("Custom");
  expect(result.current.description).toBe("Desc");
});
