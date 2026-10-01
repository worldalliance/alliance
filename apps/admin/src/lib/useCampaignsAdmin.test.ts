import type { CampaignDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useCampaignsAdmin,
  useInvalidateCampaignsAdmin,
} from "./useCampaignsAdmin";

afterEach(cleanup);

const campaign = (name: string) =>
  ({
    id: 1,
    name,
    code: "spring",
    picture: null,
    kind: "campaign",
    communityId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }) satisfies CampaignDto;

let stored = campaign("Spring drive");

serveApi(routes({ "GET /campaigns": () => Response.json([stored]) }));

afterEach(() => {
  stored = campaign("Spring drive");
});

describe("useCampaignsAdmin", () => {
  it("loads the campaigns", async () => {
    const view = renderHook(() => useCampaignsAdmin(), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.data).toEqual([campaign("Spring drive")]),
    );
  });
});

describe("useInvalidateCampaignsAdmin", () => {
  it("refetches the campaigns", async () => {
    const view = renderHook(
      () => ({
        campaigns: useCampaignsAdmin(),
        invalidate: useInvalidateCampaignsAdmin(),
      }),
      queryWrapper(),
    );
    await waitFor(() =>
      expect(view.result.current.campaigns.data).toEqual([
        campaign("Spring drive"),
      ]),
    );

    stored = campaign("Fall drive");
    await view.result.current.invalidate();

    await waitFor(() =>
      expect(view.result.current.campaigns.data).toEqual([
        campaign("Fall drive"),
      ]),
    );
  });
});
