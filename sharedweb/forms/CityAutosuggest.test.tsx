import type { CitySearchDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CityAutosuggest from "./CityAutosuggest";

const city: CitySearchDto = {
  id: 1,
  name: "Paris",
  admin1: "Île-de-France",
  countryCode: "FR",
  countryName: "France",
};

serveApi(
  routes({
    "GET /geo/search-city": ({ request }) =>
      Response.json(
        new URL(request.url).searchParams.get("query") === "Par" ? [city] : [],
      ),
  }),
);

const renderInput = () => {
  render(
    <CityAutosuggest onSelect={() => {}} debounceMs={10} />,
    queryWrapper(),
  );
  return screen.getByRole("textbox");
};

const suggestion = () => screen.queryByText(/Paris/);

it("claims Escape when it closes the shown suggestions", async () => {
  const input = renderInput();
  fireEvent.change(input, { target: { value: "Par" } });
  await waitFor(() => expect(suggestion()).not.toBeNull());

  expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false);
  expect(suggestion()).toBeNull();
});

it("leaves Escape to its container when no suggestion shows", async () => {
  const input = renderInput();
  fireEvent.change(input, { target: { value: "Par" } });
  await waitFor(() => expect(suggestion()).not.toBeNull());
  fireEvent.change(input, { target: { value: "Nowhere" } });
  await waitFor(() => expect(suggestion()).toBeNull());

  expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(true);
});
