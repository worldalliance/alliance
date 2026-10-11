import { makeAction } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ActionLink from "./ActionLink";

afterEach(cleanup);

let requested: string[] = [];
let respond: () => Response;

serveApi(
  routes({
    "GET /actions/slug/:id": ({ params }) => {
      requested.push(params.id);
      return respond();
    },
  }),
);

beforeEach(() => {
  requested = [];
  respond = () =>
    Response.json(
      makeAction({
        id: 7,
        name: "Call your representative",
        usersCompleted: 3,
      }),
    );
});

const renderLink = () => {
  const { wrapper } = queryWrapper();
  render(<ActionLink href="/actions/7">the call</ActionLink>, { wrapper });
  return screen.getByRole("link", { name: "the call" });
};

it("fetches nothing until the link is hovered", async () => {
  renderLink();

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(requested).toEqual([]);
});

it("previews the action on hover", async () => {
  fireEvent.mouseEnter(renderLink());

  expect(await screen.findByText("Call your representative")).toBeTruthy();
  expect(screen.getByText("3 completed")).toBeTruthy();
  expect(requested).toEqual(["7"]);
});

it("says the action couldn't load when the server refuses it", async () => {
  respond = () => Response.json({ message: "Not Found" }, { status: 404 });

  fireEvent.mouseEnter(renderLink());

  await waitFor(() =>
    expect(screen.getByText("Couldn't load this action.")).toBeTruthy(),
  );
});
