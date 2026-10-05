import { makeUser } from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

afterEach(cleanup);

const listsAna = () => Response.json([makeUser({ id: 7, name: "Ana" })]);
let userList = listsAna;
let userListCalls = 0;

serveApi(
  routes(
    {
      "GET /user/list": () => {
        userListCalls += 1;
        return userList();
      },
    },
    () => Response.json([]),
  ),
);

afterEach(() => {
  userList = listsAna;
  userListCalls = 0;
});

const renderBuilder = () =>
  renderFormBuilder({ pages: [{ id: "p1", fields: [] }], outputViews: [] });

describe("the form builder's preview-as picker", () => {
  it("loads users only once preview opens", async () => {
    renderBuilder();
    expect(userListCalls).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: "Ana" },
    });

    expect(await screen.findByRole("button", { name: "Ana" })).toBeTruthy();
    expect(userListCalls).toBe(1);
  });

  it("loads an empty user list once", async () => {
    userList = () => Response.json([]);
    renderBuilder();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    await screen.findByText("Preview as");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(userListCalls).toBe(1);
  });

  it("says when the users fail to load", async () => {
    userList = () => Response.json({}, { status: 500 });
    renderBuilder();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(await screen.findByText("Could not load users")).toBeTruthy();
    expect(userListCalls).toBe(1);
  });
});
