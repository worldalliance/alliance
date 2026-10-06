import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import ActionUpdatesTab from "./ActionUpdatesTab";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

let answer: (request: Request) => Response | Promise<Response> = () =>
  Response.json({});

serveApi(
  routes({
    "POST /actions/createUpdate/:id": ({ request }) => answer(request),
  }),
);

const createUpdate = (params: { mode?: string } = {}) => {
  const setUpdates = jest.fn();
  render(
    <MemoryRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ActionUpdatesTab
              actionId={4}
              updates={[]}
              setUpdates={setUpdates}
              events={[]}
              availableTags={[]}
            />
          }
        />
        <Route path="/actions/4/updates/9" element={<p>Update 9</p>} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByPlaceholderText("Title..."), {
    target: { value: "Hearing scheduled" },
  });
  fireEvent.change(screen.getByPlaceholderText("Notification message"), {
    target: { value: "a hearing on the bill" },
  });
  if (params.mode) {
    fireEvent.change(
      screen.getByRole("combobox", { name: /Recognition copy/ }),
      { target: { value: params.mode } },
    );
  }
  fireEvent.click(
    screen.getByRole("button", { name: "Create and write content" }),
  );
  return { setUpdates };
};

const refusing = (status: number, message: string) => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  answer = () => Response.json({ statusCode: status, message }, { status });
};

describe("ActionUpdatesTab", () => {
  it("adds the created update and opens it, with no error", async () => {
    answer = () =>
      Response.json({ id: 9, title: "Hearing scheduled" }, { status: 201 });

    const { setUpdates } = createUpdate();

    expect(await screen.findByText("Update 9")).toBeTruthy();
    expect(setUpdates).toHaveBeenCalledWith([
      { id: 9, title: "Hearing scheduled" },
    ]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("creates the update in the recognition mode picked", async () => {
    let body: unknown;
    answer = async (request) => {
      body = await request.json();
      return Response.json({ id: 9 }, { status: 201 });
    };

    createUpdate({ mode: "retrospective" });

    expect(await screen.findByText("Update 9")).toBeTruthy();
    expect(body).toMatchObject({ notificationMode: "retrospective" });
  });

  it("sends one create while the first is in flight", async () => {
    let requests = 0;
    answer = async () => {
      requests++;
      await Bun.sleep(20);
      return Response.json({ id: 9 }, { status: 201 });
    };

    createUpdate();
    fireEvent.click(
      screen.getByRole("button", { name: "Create and write content" }),
    );

    expect(await screen.findByText("Update 9")).toBeTruthy();
    expect(requests).toBe(1);
  });

  it("says why the server refused a new update", async () => {
    refusing(400, "notificationMode must be one of");

    createUpdate();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "notificationMode must be one of",
    );
  });

  it("keeps a server error's own text out of the message", async () => {
    refusing(500, "Internal server error");

    createUpdate();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Couldn't create the update.",
    );
  });

  it("says the create failed when the request doesn't go through", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    answer = () => {
      throw new TypeError("network down");
    };

    createUpdate();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Couldn't create the update.",
    );
  });
});
