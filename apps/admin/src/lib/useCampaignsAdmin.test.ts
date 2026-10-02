import { R } from "@alliance/common/result";
import type { CampaignDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useCampaignsAdmin,
  useCreateCampaignAdmin,
  useUpdateCampaignAdmin,
  useUploadCampaignPictureAdmin,
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
let createStatus = 200;
let updateStatus = 200;
let uploadStatus = 200;

serveApi(
  routes({
    "GET /campaigns": () => Response.json([stored]),
    "POST /campaigns": async ({ request }) => {
      if (createStatus !== 200)
        return Response.json({}, { status: createStatus });
      const { name }: { name: string } = await request.json();
      stored = { ...campaign(name), id: 2 };
      return Response.json(stored);
    },
    "POST /images/uploadImage": () =>
      uploadStatus === 200
        ? Response.json({ key: "logo-key", url: "logo-url" })
        : Response.json(
            { message: "Image too large" },
            { status: uploadStatus },
          ),
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
  createStatus = 200;
  updateStatus = 200;
  uploadStatus = 200;
});

describe("useCampaignsAdmin", () => {
  it("loads the campaigns", async () => {
    const view = renderHook(() => useCampaignsAdmin(), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.data).toEqual([campaign("Spring drive")]),
    );
  });
});

describe("useCreateCampaignAdmin", () => {
  it("hands back the created campaign once the list includes it", async () => {
    const query = queryWrapper();
    const listed: unknown[] = [];
    const view = renderHook(
      () => ({
        campaigns: useCampaignsAdmin(),
        create: useCreateCampaignAdmin({
          onSuccess: (created) =>
            listed.push(
              created,
              query.client.getQueryData(queryKeys.campaignsAdmin()),
            ),
          onError: () => {},
        }),
      }),
      query,
    );
    await waitFor(() =>
      expect(view.result.current.campaigns.data).toBeTruthy(),
    );

    view.result.current.create.mutate({ name: "Fall drive" });

    const created = { ...campaign("Fall drive"), id: 2 };
    await waitFor(() => expect(listed).toEqual([created, [created]]));
  });

  it("reports a refused create", async () => {
    createStatus = 500;
    const onError = jest.fn();
    const view = renderHook(
      () => useCreateCampaignAdmin({ onSuccess: () => {}, onError }),
      queryWrapper(),
    );

    view.result.current.mutate({ name: "Fall drive" });

    await waitFor(() => expect(onError).toHaveBeenCalled());
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

describe("useUploadCampaignPictureAdmin", () => {
  const upload = async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const view = renderHook(
      () => ({
        campaigns: useCampaignsAdmin(),
        upload: useUploadCampaignPictureAdmin({ onSuccess, onError }),
      }),
      queryWrapper(),
    );
    await waitFor(() =>
      expect(view.result.current.campaigns.data).toBeTruthy(),
    );
    view.result.current.upload.mutate({
      id: 1,
      file: new File(["logo"], "logo.png", { type: "image/png" }),
    });
    return { view, onSuccess, onError };
  };

  const uploadResult = async () => {
    const { view, onSuccess } = await upload();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    return { view, result: onSuccess.mock.calls[0][0] };
  };

  it("saves the uploaded picture and refetches the campaigns", async () => {
    const { view, result } = await uploadResult();

    expect(result).toEqual(R.success(undefined));
    await waitFor(() =>
      expect(view.result.current.campaigns.data).toEqual([
        { ...campaign("Spring drive"), picture: "logo-key" },
      ]),
    );
  });

  it("reports a refused save through onError and refetches", async () => {
    updateStatus = 500;

    const { view, onSuccess, onError } = await upload();

    await waitFor(() =>
      expect(view.result.current.campaigns.data).toEqual([
        campaign("Changed elsewhere"),
      ]),
    );
    expect(onError).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("hands back why the image upload failed, saving nothing", async () => {
    uploadStatus = 413;

    const { result } = await uploadResult();

    expect(result).toEqual(R.failure("Image too large"));
    expect(stored).toEqual(campaign("Spring drive"));
  });
});
