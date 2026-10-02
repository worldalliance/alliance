import type { CampaignDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useCampaignsAdmin,
  useInvalidateCampaignsAdmin,
  useUpdateCampaignAdmin,
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

let stored: CampaignDto = campaign("Spring drive");
let updateStatus = 200;

serveApi(
  routes({
    "GET /campaigns": () => Response.json([stored]),
    "PATCH /campaigns/:id": async ({ request }) => {
      if (updateStatus !== 200) {
        stored = campaign("Changed elsewhere");
        return Response.json({}, { status: updateStatus });
      }
      const body: Partial<CampaignDto> = await request.json();
      stored = { ...stored, ...body };
      return Response.json(stored);
    },
  }),
);

afterEach(() => {
  stored = campaign("Spring drive");
  updateStatus = 200;
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

describe("useUpdateCampaignAdmin", () => {
  const renderUpdate = (onError: (err: Error) => void = () => {}) => {
    const onSuccess = jest.fn();
    const view = renderHook(
      () => ({
        campaigns: useCampaignsAdmin(),
        update: useUpdateCampaignAdmin({ onSuccess, onError }),
      }),
      queryWrapper(),
    );
    return { view, onSuccess };
  };

  it("refetches the campaigns after an update", async () => {
    const { view, onSuccess } = renderUpdate();
    await waitFor(() =>
      expect(view.result.current.campaigns.data).toBeTruthy(),
    );

    view.result.current.update.mutate({
      id: 1,
      body: { kind: "organization" },
    });

    await waitFor(() =>
      expect(view.result.current.campaigns.data).toEqual([
        { ...campaign("Spring drive"), kind: "organization" },
      ]),
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it("refetches the campaigns after a refused update", async () => {
    updateStatus = 409;
    const onError = jest.fn();
    const { view, onSuccess } = renderUpdate(onError);
    await waitFor(() =>
      expect(view.result.current.campaigns.data).toBeTruthy(),
    );

    view.result.current.update.mutate({ id: 1, body: { name: "Bolt" } });

    await waitFor(() =>
      expect(view.result.current.campaigns.data).toEqual([
        campaign("Changed elsewhere"),
      ]),
    );
    expect(onError).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
