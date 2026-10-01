import type { StaffDirectoryEntryDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  useSaveStaffDirectoryAdmin,
  useStaffDirectoryAdmin,
} from "./useStaffDirectoryAdmin";

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

let saved = [entry(1, "Ada")];
let loadGate = Promise.resolve();
const puts: unknown[] = [];

serveApi(
  routes({
    "GET /user/staff-directory-admin": () => {
      const snapshot = saved;
      return loadGate.then(() => Response.json(snapshot));
    },
    "PUT /user/staff-directory-admin": async ({ request }) => {
      puts.push(await request.json());
      saved = [entry(2, "Grace"), entry(1, "Ada")];
      return Response.json(saved);
    },
  }),
);

afterEach(() => {
  saved = [entry(1, "Ada")];
  loadGate = Promise.resolve();
  puts.length = 0;
});

describe("useStaffDirectoryAdmin", () => {
  it("loads the directory", async () => {
    const view = renderHook(() => useStaffDirectoryAdmin(), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.data).toEqual([entry(1, "Ada")]),
    );
  });
});

describe("useSaveStaffDirectoryAdmin", () => {
  it("sends the rows' order and caches the saved directory", async () => {
    const onSuccess = mock(() => {});
    const view = renderHook(
      () => ({
        directory: useStaffDirectoryAdmin(),
        save: useSaveStaffDirectoryAdmin({ onSuccess, onError: () => {} }),
      }),
      queryWrapper(),
    );
    await waitFor(() =>
      expect(view.result.current.directory.data).toEqual([entry(1, "Ada")]),
    );

    await view.result.current.save.mutateAsync([
      entry(2, "Grace"),
      entry(1, "Ada"),
    ]);

    expect(puts).toEqual([
      {
        items: [
          { id: 2, staffTitle: null, staffLink: null, staffDisplayOrder: 0 },
          { id: 1, staffTitle: null, staffLink: null, staffDisplayOrder: 1 },
        ],
      },
    ]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(view.result.current.directory.data).toEqual([
        entry(2, "Grace"),
        entry(1, "Ada"),
      ]),
    );
  });

  it("keeps the save when a refetch started before it lands after it", async () => {
    const query = queryWrapper();
    const view = renderHook(
      () => ({
        directory: useStaffDirectoryAdmin(),
        save: useSaveStaffDirectoryAdmin({
          onSuccess: () => {},
          onError: () => {},
        }),
      }),
      query,
    );
    await waitFor(() =>
      expect(view.result.current.directory.data).toEqual([entry(1, "Ada")]),
    );

    let releaseLoad = () => {};
    loadGate = new Promise((resolve) => {
      releaseLoad = resolve;
    });
    const refetch = query.client.refetchQueries();
    await view.result.current.save.mutateAsync([entry(1, "Ada")]);

    await act(async () => {
      releaseLoad();
      await refetch;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(view.result.current.directory.data).toEqual([
      entry(2, "Grace"),
      entry(1, "Ada"),
    ]);
  });
});
