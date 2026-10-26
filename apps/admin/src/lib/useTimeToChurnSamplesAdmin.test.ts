import type { TimeToChurnSampleDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { useTimeToChurnSamplesAdmin } from "./useTimeToChurnSamplesAdmin";

const samples: TimeToChurnSampleDto[] = [{ daysToChurn: 9 }];

let respond: () => Response;

serveApi(
  routes({
    "GET /analytics/time-to-churn": () => respond(),
  }),
);

beforeEach(() => {
  respond = () => Response.json(samples);
});

describe("useTimeToChurnSamplesAdmin", () => {
  it("reads each churned member's days to churn", async () => {
    const view = renderHook(() => useTimeToChurnSamplesAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual(samples));
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

    const view = renderHook(() => useTimeToChurnSamplesAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
