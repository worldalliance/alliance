import { act, renderHook, waitFor } from "@testing-library/react";
import type { CitySearchDto } from "../client";
import { queryWrapper } from "../lib/testing/queryWrapper";
import { routes, serveApi } from "../lib/testing/serveApi";
import {
  type CityAutosuggestParams,
  useCityAutosuggest,
} from "./cityAutosuggest";

const city = (name: string): CitySearchDto => ({
  id: name.length,
  name,
  admin1: "Region",
  countryCode: "XX",
  countryName: "Country",
});

let searched: string[] = [];
let searchedNear: (string | null)[] = [];
let failing = false;
const held = new Map<string, Promise<void>>();

serveApi(
  routes({
    "GET /geo/search-city": async ({ request }) => {
      const query = new URL(request.url).searchParams.get("query") ?? "";
      searched.push(query);
      searchedNear.push(new URL(request.url).searchParams.get("latitude"));
      await held.get(query);
      return failing
        ? Response.json({ message: "Internal server error" }, { status: 500 })
        : Response.json([city(query)]);
    },
  }),
);

afterEach(() => {
  searched = [];
  searchedNear = [];
  failing = false;
  held.clear();
});

const render = (
  props: Partial<CityAutosuggestParams> = {},
  query = queryWrapper(),
) =>
  renderHook(
    () => useCityAutosuggest({ debounceMs: 10, onSelect: () => {}, ...props }),
    query,
  );

describe("useCityAutosuggest", () => {
  it("searches once typing settles, and opens on the answer", async () => {
    const hook = render();
    act(() => hook.result.current.setQuery("P"));
    act(() => hook.result.current.setQuery("Pa"));
    act(() => hook.result.current.setQuery("Par"));
    act(() => hook.result.current.setHighlighted(2));

    await waitFor(() =>
      expect(hook.result.current.results).toEqual([city("Par")]),
    );
    expect(searched).toEqual(["Par"]);
    expect(hook.result.current.open).toBe(true);
    expect(hook.result.current.highlighted).toBe(-1);
  });

  it("sends a shorter text than the minimum length nowhere, and clears the results", async () => {
    const hook = render({ minLength: 3 });
    act(() => hook.result.current.setQuery("Paris"));
    await waitFor(() => expect(hook.result.current.results).toHaveLength(1));

    act(() => hook.result.current.setQuery("Pa"));

    await waitFor(() => expect(hook.result.current.results).toEqual([]));
    expect(searched).toEqual(["Paris"]);
  });

  it("searches only the text before the first comma, sharing its answer", async () => {
    const hook = render();
    act(() => hook.result.current.setQuery(" Paris "));
    await waitFor(() => expect(hook.result.current.results).toHaveLength(1));
    act(() => hook.result.current.setOpen(false));

    act(() => hook.result.current.setQuery("Paris, Fr"));

    await waitFor(() => expect(hook.result.current.open).toBe(true));
    expect(searched).toEqual(["Paris"]);
    expect(hook.result.current.results).toEqual([city("Paris")]);
  });

  it("answers a text it already searched from the cache alone", async () => {
    const hook = render();
    act(() => hook.result.current.setQuery("Lima"));
    await waitFor(() => expect(searched).toEqual(["Lima"]));
    act(() => hook.result.current.setQuery("Lim"));
    await waitFor(() =>
      expect(hook.result.current.results).toEqual([city("Lim")]),
    );

    act(() => hook.result.current.setQuery("Lima"));

    await waitFor(() =>
      expect(hook.result.current.results).toEqual([city("Lima")]),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(searched).toEqual(["Lima", "Lim"]);
  });

  it("keeps the last answer up while the next loads, and never shows a superseded one", async () => {
    const hook = render();
    act(() => hook.result.current.setQuery("Lima"));
    await waitFor(() => expect(hook.result.current.results).toHaveLength(1));

    const slow = Promise.withResolvers<void>();
    held.set("Lim", slow.promise);
    act(() => hook.result.current.setQuery("Lim"));
    await waitFor(() => expect(searched).toEqual(["Lima", "Lim"]));
    expect(hook.result.current.results).toEqual([city("Lima")]);

    act(() => hook.result.current.setQuery("Lyon"));
    await waitFor(() =>
      expect(hook.result.current.results).toEqual([city("Lyon")]),
    );
    slow.resolve();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(hook.result.current.results).toEqual([city("Lyon")]);
  });

  it("clears the results as soon as the search fails, whatever the app's retries", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});
    const hook = render({}, queryWrapper({ retry: 3 }));
    act(() => hook.result.current.setQuery("Oslo"));
    await waitFor(() => expect(hook.result.current.results).toHaveLength(1));

    failing = true;
    act(() => hook.result.current.setQuery("Osaka"));

    await waitFor(() => expect(hook.result.current.results).toEqual([]));
    expect(logged).toHaveBeenCalledWith("Geo search failed", {
      message: "Internal server error",
      statusCode: 500,
    });
  });

  it("asks again for a text whose last search failed", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    failing = true;
    const hook = render();
    act(() => hook.result.current.setQuery("Oslo"));
    await waitFor(() => expect(hook.result.current.open).toBe(true));

    failing = false;
    act(() => hook.result.current.setQuery("Oslo, N"));

    await waitFor(() =>
      expect(hook.result.current.results).toEqual([city("Oslo")]),
    );
    expect(searched).toEqual(["Oslo", "Oslo"]);
  });

  it("shows a failure that answers in the millisecond its search started", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(Date, "now").mockReturnValue(1_000);
    failing = true;
    const hook = render();

    act(() => hook.result.current.setQuery("Oslo"));

    await waitFor(() => expect(hook.result.current.open).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(searched).toEqual(["Oslo"]);
  });

  it("stays closed when a search answers after a city is picked", async () => {
    const hook = render();
    const slow = Promise.withResolvers<void>();
    held.set("Rome", slow.promise);
    act(() => hook.result.current.setQuery("Rome"));
    await waitFor(() => expect(searched).toEqual(["Rome"]));

    act(() => hook.result.current.selectCity(city("Roma")));
    slow.resolve();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(hook.result.current.open).toBe(false);
    expect(hook.result.current.results).toEqual([]);
    expect(hook.result.current.query).toBe("Roma, Region, Country");
  });

  it("stays closed when a search answers after a custom value is committed", async () => {
    const onSelect = jest.fn();
    const hook = render({ onSelect });
    const slow = Promise.withResolvers<void>();
    held.set("Atlantis", slow.promise);
    act(() => hook.result.current.setQuery("Atlantis"));
    await waitFor(() => expect(searched).toEqual(["Atlantis"]));

    act(() => hook.result.current.commitCustomValue());
    slow.resolve();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onSelect).toHaveBeenCalledWith("Atlantis");
    expect(hook.result.current.open).toBe(false);
    expect(hook.result.current.results).toEqual([]);
  });

  it("does not search for the value it starts with", async () => {
    render({ value: "Berlin" });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(searched).toEqual([]);
  });

  it("searches the typed text again near the device once its location arrives", async () => {
    const hook = render();
    act(() => hook.result.current.setQuery("Paris"));
    await waitFor(() => expect(hook.result.current.results).toHaveLength(1));
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ latitude: 48.8, longitude: 2.3 }));

    await act(() => hook.result.current.fetchGeolocation());

    await waitFor(() => expect(searchedNear).toEqual([null, "48.8"]));
    expect(searched).toEqual(["Paris", "Paris"]);
  });
});
