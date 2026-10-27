import { onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { CitySearchDto } from "../client";
import { queryKeys } from "../lib/queryKeys";
import { queryWrapper } from "../lib/testing/queryWrapper";
import { routes, serveApi } from "../lib/testing/serveApi";
import { useCitySearch } from "./useCitySearch";

const paris: CitySearchDto = {
  id: 1,
  name: "Paris",
  admin1: "Île-de-France",
  countryCode: "FR",
  countryName: "France",
};

let sent: Record<string, string> = {};

serveApi(
  routes({
    "GET /geo/search-city": ({ request }) => {
      sent = Object.fromEntries(new URL(request.url).searchParams);
      return Response.json([paris]);
    },
  }),
);

describe("useCitySearch", () => {
  it("searches near the given location, cached per text and location", async () => {
    const query = queryWrapper();
    const view = renderHook(
      () =>
        useCitySearch({
          text: "Paris",
          geo: { latitude: 48.8, longitude: 2.3 },
          enabled: true,
        }),
      query,
    );

    await waitFor(() => expect(view.result.current.data).toEqual([paris]));
    expect(sent).toEqual({
      query: "Paris",
      latitude: "48.8",
      longitude: "2.3",
    });
    expect(
      query.client.getQueryData<CitySearchDto[]>(
        queryKeys.citySearch({ text: "Paris", latitude: 48.8, longitude: 2.3 }),
      ),
    ).toEqual([paris]);
  });

  it("searches while the device reports being offline", async () => {
    onlineManager.setOnline(false);
    try {
      const view = renderHook(
        () => useCitySearch({ text: "Paris", geo: null, enabled: true }),
        queryWrapper(),
      );

      await waitFor(() => expect(view.result.current.data).toEqual([paris]));
    } finally {
      onlineManager.setOnline(true);
    }
  });
});
