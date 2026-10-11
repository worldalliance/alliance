import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import AmbassadorProgramPage from "./AmbassadorProgramPage";

afterEach(cleanup);

serveApi(
  routes({
    "GET /user/ambassadorProgram": () =>
      Response.json({
        members: [],
        projection: { generatedAt: "2026-10-05T00:00:00.000Z", points: [] },
      }),
    "GET /user/list-graph": () =>
      Response.json([makeUser({ id: 3, name: "Sam Pool" })]),
  }),
);

it("offers the member pool when adding a program member", async () => {
  const { wrapper } = queryWrapper();
  render(
    <MemoryRouter>
      <AmbassadorProgramPage />
    </MemoryRouter>,
    { wrapper },
  );

  expect(
    await screen.findAllByRole("option", { name: /Sam Pool/ }),
  ).toHaveLength(2);
});
