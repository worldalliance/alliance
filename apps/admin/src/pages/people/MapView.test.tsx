import type { UserCityCountDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { MapView } from "./MapView";

let respond: () => Response;

serveApi(
  routes({
    "GET /user/cityCounts": () => respond(),
  }),
);

const renderPage = () => {
  const { wrapper: QueryProvider } = queryWrapper();
  render(
    <QueryProvider>
      <MapView />
    </QueryProvider>,
  );
};

const statValue = (label: string) =>
  screen.getByText(label).nextElementSibling?.textContent;

it("summarizes the loaded counts", async () => {
  const counts: UserCityCountDto[] = [
    { cityId: 1, cityName: "Springfield", countryCode: "US", count: 3 },
    { cityId: 2, cityName: "Lyon", countryCode: "FR", count: 1 },
    { cityId: null, count: 2 },
  ];
  respond = () => Response.json(counts);

  renderPage();

  expect(
    await screen.findByText("Members with an active contract"),
  ).toBeTruthy();
  expect(statValue("Members with an active contract")).toBe("6");
  expect(statValue("With a location")).toBe("4");
  expect(statValue("Outside the US")).toBe("1");
});

it("reports a failed load instead of the no-data message or zero counts", async () => {
  respond = () => Response.json({ message: "Internal error" }, { status: 500 });

  renderPage();

  expect(
    await screen.findByText("Couldn't load member locations"),
  ).toBeTruthy();
  expect(screen.getByText("The server didn't answer. Try again.")).toBeTruthy();
  expect(screen.queryByText("No member locations yet")).toBe(null);
  expect(screen.queryByText("Members with an active contract")).toBe(null);
});
