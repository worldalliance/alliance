import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeTag } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { omit } from "es-toolkit";
import { useTagsAdmin } from "./useTagsAdmin";

const tagDto = makeTag();
const volunteers = omit(tagDto, ["users"]);

let summaryLoads: number;

serveApi(
  routes({
    "GET /user/tags": () => Response.json([tagDto]),
    "GET /user/tag-summaries": () => {
      summaryLoads += 1;
      return Response.json([volunteers]);
    },
    "POST /user/createTag": () => Response.json(tagDto),
    "POST /user/tags/:tagId/update": () => Response.json(tagDto),
    "DELETE /user/tags/:tagId": () => Response.json({}),
    "POST /user/tags/:tagId/addUser": () => Response.json(tagDto),
  }),
);

beforeEach(() => {
  summaryLoads = 0;
});

const renderTags = (params?: Parameters<typeof useTagsAdmin>[0]) => {
  const { client, wrapper } = queryWrapper();
  const view = renderHook(() => useTagsAdmin(params), { wrapper });
  return { client, view };
};

it("loads the summaries only when asked", async () => {
  const { view } = renderTags({ summariesEnabled: true });
  await waitFor(() =>
    expect(view.result.current.summaries.data).toEqual([volunteers]),
  );

  const { view: withoutSummaries } = renderTags();
  await waitFor(() =>
    expect(withoutSummaries.result.current.tags).toEqual([tagDto]),
  );
  expect(summaryLoads).toBe(1);
});

it.each([
  [
    "creating",
    (tags: ReturnType<typeof useTagsAdmin>) =>
      tags.createTag.mutateAsync({
        name: "New",
        description: "",
        publicDisplayName: null,
      }),
  ],
  [
    "renaming",
    (tags: ReturnType<typeof useTagsAdmin>) =>
      tags.updateTag.mutateAsync({
        tagId: "tag-1",
        body: { name: "Renamed", description: "", publicDisplayName: null },
      }),
  ],
  [
    "deleting",
    (tags: ReturnType<typeof useTagsAdmin>) =>
      tags.deleteTag.mutateAsync("tag-1"),
  ],
])("reloads the summaries after %s a tag", async (_, write) => {
  const { view } = renderTags({ summariesEnabled: true });
  await waitFor(() => expect(summaryLoads).toBe(1));

  await write(view.result.current);

  expect(summaryLoads).toBe(2);
});

it("leaves the summaries alone when a member joins a tag", async () => {
  const { client, view } = renderTags({ enabled: false });
  client.setQueryData(queryKeys.tagSummariesAdmin(), [volunteers]);

  await view.result.current.addUserToTag.mutateAsync({
    tagId: "tag-1",
    body: { userId: 7 },
  });

  expect(
    client.getQueryState(queryKeys.tagSummariesAdmin())?.isInvalidated,
  ).toBe(false);
});
