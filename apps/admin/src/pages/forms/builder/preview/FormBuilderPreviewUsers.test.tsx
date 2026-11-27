import { makeUser } from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderFormBuilder } from "../../../../lib/testing/renderFormBuilder";

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
    const search = await screen.findByRole("combobox");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.change(search, { target: { value: "Ana" } });

    expect(await screen.findByRole("option", { name: "Ana" })).toBeTruthy();
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

    expect(await screen.findByText(/Couldn't load users/)).toBeTruthy();
    expect(userListCalls).toBe(1);
  });

  it("loads the users again on Try again", async () => {
    userList = () => Response.json({}, { status: 500 });
    renderBuilder();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    await waitFor(() => expect(userListCalls).toBe(2));
  });
});
