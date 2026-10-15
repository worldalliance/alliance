import type { UserCityCountDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen } from "@testing-library/react";
import MemberMapPage from "./MemberMapPage";

afterEach(cleanup);

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
      <MemberMapPage />
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

  expect(await screen.findByText("Total members")).toBeTruthy();
  expect(statValue("Total members")).toBe("6");
  expect(statValue("Members with location")).toBe("4");
  expect(statValue("Non-US members")).toBe("1");
});

it("reports a failed load instead of the no-data message or zero counts", async () => {
  respond = () => Response.json({ message: "Internal error" }, { status: 500 });

  renderPage();

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Unable to load member locations. Please try again later.",
  );
  expect(screen.queryByText("No member location data available yet.")).toBe(
    null,
  );
  expect(screen.queryByText("Total members")).toBe(null);
});
