import type { StaffDirectoryEntryDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useStaffDirectoryAdmin } from "./useStaffDirectoryAdmin";

afterEach(cleanup);

const entry = (id: number, displayName: string) =>
  ({
    id,
    displayName,
    profilePicture: null,
    staffTitle: null,
    staffLink: null,
    staffDisplayOrder: id,
  }) satisfies StaffDirectoryEntryDto;

serveApi(
  routes({
    "GET /user/staff-directory-admin": () => Response.json([entry(1, "Ada")]),
  }),
);

describe("useStaffDirectoryAdmin", () => {
  it("loads the directory", async () => {
    const view = renderHook(() => useStaffDirectoryAdmin(), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.data).toEqual([entry(1, "Ada")]),
    );
  });
});
