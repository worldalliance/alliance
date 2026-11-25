import type {
  PartitionPreviewResultDto,
  SuitePartitionDto,
} from "@alliance/shared/client";
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "bun:test";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { LeaveGuardContext } from "../../../lib/useLeaveGuard";
import { SaveState } from "../../../ui/templates/Form";
import { usePartitionEditor } from "./usePartitionEditor";

const partition: SuitePartitionDto = {
  versionId: 1,
  parts: [
    {
      id: "00000000-0000-4000-8000-0000000000e1",
      name: "Everyone else",
      text: null,
      fallback: null,
      noRequiredWorkTick: null,
      cells: [],
    },
  ],
  actions: [{ id: 1, name: "Call" }],
  launched: false,
  launchFailedAt: null,
  launchFailure: null,
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <LeaveGuardContext.Provider value={new Set()}>
      {children}
    </LeaveGuardContext.Provider>
  </MemoryRouter>
);

it("saves while a preview runs", async () => {
  let finishPreview = (_: PartitionPreviewResultDto) => {};
  let saves = 0;
  const { result } = renderHook(
    () =>
      usePartitionEditor({
        partition,
        onSave: async () => {
          saves += 1;
          return { partition, problems: [], warnings: [] };
        },
        onPreview: () =>
          new Promise((resolve) => {
            finishPreview = resolve;
          }),
      }),
    { wrapper },
  );

  act(() => void result.current.runPreview());
  expect(result.current.previewRunning).toBe(true);
  await act(() => result.current.save());

  expect(saves).toBe(1);
  expect(result.current.saveState).toBe(SaveState.Saved);
  expect(result.current.previewRunning).toBe(true);
  act(() => finishPreview({ problems: [] }));
  await waitFor(() => expect(result.current.previewRunning).toBe(false));
});
