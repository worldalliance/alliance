import { FORMULA_SOURCES_CHANGED } from "@alliance/common/forms/formula-options";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, mock } from "bun:test";
import { formulaSourcesChangedRefreshed } from "../lib/copy";
import { useFormulaSourcesRefetch } from "./useFormulaSourcesRefetch";

afterEach(cleanup);

const refusal = (status: number, message: string) => ({
  response: new Response(null, { status }),
  error: { statusCode: status, message },
});

it("refetches the histories and says so when they changed", () => {
  const setError = mock();
  const { result } = renderHook(() => useFormulaSourcesRefetch(setError));

  let handled = false;
  act(() => {
    handled = result.current.refetchIfSourcesChanged(
      refusal(409, FORMULA_SOURCES_CHANGED),
    );
  });

  expect(handled).toBe(true);
  expect(result.current.reload).toBe(1);
  expect(setError).toHaveBeenCalledWith(formulaSourcesChangedRefreshed);
});

it("leaves any other failure to the caller", () => {
  const setError = mock();
  const { result } = renderHook(() => useFormulaSourcesRefetch(setError));

  let handled = true;
  act(() => {
    handled = result.current.refetchIfSourcesChanged(
      refusal(409, "Already submitted"),
    );
  });

  expect(handled).toBe(false);
  expect(result.current.reload).toBe(0);
  expect(setError).not.toHaveBeenCalled();
});
