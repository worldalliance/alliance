import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import SearchBar from "./SearchBar";

let searchFails = true;

serveApi(
  routes({
    "GET /search/all": () =>
      searchFails
        ? Response.json({ message: "Internal server error" }, { status: 500 })
        : Response.json([
            { id: "user-1", name: "Ada", type: "user", webAppLocation: "/" },
          ]),
  }),
);

afterEach(() => {
  searchFails = true;
});

it("offers a retry when a search fails", async () => {
  render(
    <MemoryRouter>
      <SearchBar autofocus={false} />
    </MemoryRouter>,
    { wrapper: queryWrapper().wrapper },
  );
  fireEvent.change(screen.getByPlaceholderText(/Search for members/), {
    target: { value: "ada" },
  });
  await screen.findByText("Couldn't search.");
  expect(screen.queryByText("No results found")).toBeNull();

  searchFails = false;
  fireEvent.click(screen.getByText("Try again"));

  await screen.findByText("Ada");
});
