import type { UserCityCountDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useUserCityCountsAdmin } from "./useUserCityCountsAdmin";

afterEach(cleanup);

const counts: UserCityCountDto[] = [
  {
    cityId: 1,
    cityName: "Springfield",
    countryCode: "US",
    count: 3,
    latitude: 39.8,
    longitude: -89.6,
  },
];

let respond: () => Response;

serveApi(
  routes({
    "GET /user/cityCounts": () => respond(),
  }),
);

beforeEach(() => {
  respond = () => Response.json(counts);
});

describe("useUserCityCountsAdmin", () => {
  it("reads member counts per city", async () => {
    const view = renderHook(() => useUserCityCountsAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual(counts));
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

    const view = renderHook(() => useUserCityCountsAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
