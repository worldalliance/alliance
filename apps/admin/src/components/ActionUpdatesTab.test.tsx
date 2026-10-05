import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ActionUpdatesTab from "./ActionUpdatesTab";

afterEach(cleanup);

const sent: unknown[] = [];

serveApi(
  routes({
    "POST /actions/createUpdate/:id": async ({ request }) => {
      sent.push(await request.json());
      return Response.json({ id: 9 }, { status: 201 });
    },
  }),
);

describe("ActionUpdatesTab", () => {
  it("creates the update in the recognition mode picked", async () => {
    render(
      <MemoryRouter>
        <ActionUpdatesTab
          actionId={4}
          updates={[]}
          setUpdates={jest.fn()}
          events={[]}
          availableTags={[]}
        />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText("Title..."), {
      target: { value: "Hearing scheduled" },
    });
    fireEvent.change(screen.getByPlaceholderText("Notification message"), {
      target: { value: "a hearing on the bill" },
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: /Recognition copy/ }),
      {
        target: { value: "retrospective" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create and write content" }),
    );

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ notificationMode: "retrospective" });
  });
});
