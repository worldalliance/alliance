import {
  CopyTextFormat,
  type CopyTextBlock,
} from "@alliance/common/forms/display-blocks";
import { pending, type Pending } from "@alliance/shared/lib/testing/pending";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { EditorSidebar } from "../../../../lib/testing/EditorSidebar";
import { SiteOriginLinkProvider } from "../../../../ui/SiteAppProvider";
import { ToastProvider } from "../../../../ui/ToastProvider";
import { EditableCopyTextBlock } from "./EditableCopyTextBlock";

let userList: () => Response | Promise<Response> = () => Response.json([]);

serveApi(routes({ "GET /user/list": () => userList() }));

afterEach(() => {
  userList = () => Response.json([]);
});

const renderEditor = (block: CopyTextBlock, onUpdate = jest.fn()) => {
  const query = queryWrapper();
  const editor = (current: CopyTextBlock) => (
    <ToastProvider>
      <SiteOriginLinkProvider origin="https://thealliance.org">
        <EditorSidebar>
          <EditableCopyTextBlock
            block={current}
            onUpdate={onUpdate}
            onRemove={() => {}}
          />
        </EditorSidebar>
      </SiteOriginLinkProvider>
    </ToastProvider>
  );
  const { rerender } = render(editor(block), query);
  return {
    onUpdate,
    client: query.client,
    rerender: (next: CopyTextBlock) => rerender(editor(next)),
  };
};

const toggleFrom = (block: CopyTextBlock) => {
  const { onUpdate } = renderEditor(block);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Rich text (markdown)" }),
  );
  return onUpdate.mock.calls[0][0];
};

const plain: CopyTextBlock = {
  type: "display",
  kind: "copytext",
  id: "block-1",
  text: "",
};

describe("the copy text rich text toggle", () => {
  it("turns markdown on", () => {
    expect(toggleFrom(plain)).toEqual({ format: CopyTextFormat.Markdown });
  });

  it("turns markdown off", () => {
    expect(toggleFrom({ ...plain, format: CopyTextFormat.Markdown })).toEqual({
      format: undefined,
    });
  });

  it("sets every user's content alike", () => {
    expect(
      toggleFrom({
        ...plain,
        manualPerUser: true,
        manualUserContent: {
          "7": { text: "Dear Ana" },
          "8": { text: "Dear Ben", format: CopyTextFormat.Plain },
        },
      }),
    ).toEqual({
      format: CopyTextFormat.Markdown,
      manualUserContent: {
        "7": { text: "Dear Ana", format: CopyTextFormat.Markdown },
        "8": { text: "Dear Ben", format: CopyTextFormat.Markdown },
      },
    });
  });
});

describe("the copy text preview", () => {
  it("renders a rich block's markdown in the larger editor", async () => {
    renderEditor({
      ...plain,
      text: "Dear **council**",
      format: CopyTextFormat.Markdown,
    });

    fireEvent.click(
      screen.getByRole("button", { name: /^Open larger editor/ }),
    );

    expect((await screen.findByText("council")).tagName).toBe("STRONG");
  });
});

describe("a per-user copy text block's user list", () => {
  const perUser: CopyTextBlock = {
    ...plain,
    manualPerUser: true,
    manualUserContent: { "7": { text: "Dear Ana" } },
  };
  const listsAnaAndBen = () =>
    Response.json([
      { id: 7, name: "Ana", hasActiveContract: true },
      { id: 8, name: "Ben", hasActiveContract: true },
    ]);

  it("says in the user sheet when the users fail to load", async () => {
    userList = () => Response.json({}, { status: 500 });
    renderEditor(perUser);
    await screen.findByText("Unable to load users");
    fireEvent.click(screen.getByRole("button", { name: / set \/ / }));
    const sheet = within(await screen.findByRole("dialog"));
    expect(sheet.getByText("Unable to load users")).toBeTruthy();
    expect(sheet.queryByText("No users match your search.")).toBeNull();
  });

  it("says when the users fail to load and loads them on retry", async () => {
    userList = () => Response.json({}, { status: 500 });
    renderEditor(perUser);

    await screen.findByText("Unable to load users");
    const retries: Pending<Response>[] = [];
    userList = () => pending(retries);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(retries).toHaveLength(1));
    expect(screen.queryByText("Unable to load users")).toBeNull();
    expect(screen.getAllByText("Loading users…").length).toBeGreaterThan(0);

    await act(async () => retries[0].resolve(listsAnaAndBen()));
    expect(await screen.findByText("1 set / 2 total")).toBeTruthy();
    expect(screen.queryByText("Unable to load users")).toBeNull();
  });

  it("keeps loaded users while a later refetch runs and when it fails", async () => {
    userList = listsAnaAndBen;
    const { client } = renderEditor(perUser);
    await screen.findByText("1 set / 2 total");

    const refetches: Pending<Response>[] = [];
    userList = () => pending(refetches);
    void client.refetchQueries();
    await waitFor(() => expect(refetches).toHaveLength(1));

    expect(screen.getByText("1 set / 2 total")).toBeTruthy();
    expect(screen.queryByText("Loading users…")).toBeNull();

    await act(async () =>
      refetches[0].resolve(Response.json({}, { status: 500 })),
    );
    await waitFor(() => expect(client.isFetching()).toBe(0));

    expect(screen.getByText("1 set / 2 total")).toBeTruthy();
    expect(screen.queryByText("Unable to load users")).toBeNull();
  });

  it("pages through the users, naming the one being edited", async () => {
    userList = listsAnaAndBen;
    renderEditor(perUser);
    await screen.findByText("1 set / 2 total");
    expect(screen.getByText("0/2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("1/2")).toBeTruthy();
    expect(screen.getByText("Editing content for Ana")).toBeTruthy();
    expect(
      screen.getByText("Custom content saved for this user."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Editing content for Ben")).toBeTruthy();
    expect(screen.getByText("Using the default content.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("1/2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("2/2")).toBeTruthy();
  });

  it("lists the users by name and finds one by name or id", async () => {
    userList = () =>
      Response.json([
        { id: 8, name: "ben", hasActiveContract: true },
        { id: 7, name: "Ana", hasActiveContract: true },
      ]);
    renderEditor(perUser);
    fireEvent.click(await screen.findByText("1 set / 2 total"));
    const rows = () =>
      screen
        .getAllByRole("button", { name: /(Set|Unset)$/ })
        .map((row) => row.textContent);
    expect(rows()).toEqual(["AnaSet", "benUnset"]);

    const search = screen.getByPlaceholderText("Search users");
    fireEvent.change(search, { target: { value: "nobody" } });
    expect(screen.getByText("No users match your search.")).toBeTruthy();
    fireEvent.change(search, { target: { value: "BE" } });
    expect(rows()).toEqual(["benUnset"]);
    fireEvent.change(search, { target: { value: "7" } });
    expect(rows()).toEqual(["AnaSet"]);

    fireEvent.click(screen.getByRole("button", { name: "Ana Set" }));
    expect(screen.getByText("Editing content for Ana")).toBeTruthy();
  });

  it("closes the list and clears its search once per-user content turns off", async () => {
    userList = listsAnaAndBen;
    const { rerender } = renderEditor(perUser);
    fireEvent.click(await screen.findByText("1 set / 2 total"));
    fireEvent.change(screen.getByPlaceholderText("Search users"), {
      target: { value: "ana" },
    });

    rerender({ ...perUser, manualPerUser: false });
    rerender(perUser);
    expect(screen.queryByPlaceholderText("Search users")).toBeNull();

    fireEvent.click(screen.getByText("1 set / 2 total"));
    expect(
      screen.getByPlaceholderText<HTMLInputElement>("Search users").value,
    ).toBe("");
  });

  it("clears the content of a user picked from those with content", async () => {
    userList = listsAnaAndBen;
    const { onUpdate } = renderEditor({
      ...perUser,
      manualUserContent: {
        "7": { text: "Dear Ana" },
        "9": { text: "Dear Cy" },
      },
    });
    await screen.findByText("Users with content (1)");
    expect(screen.getByText("Missing (1)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ben" }));
    expect(screen.getByText("Using default")).toBeTruthy();
    expect(screen.queryByText("Clear content for this user")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ana" }));
    expect(screen.getByText("Custom content")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Clear content for this user" }),
    );
    expect(onUpdate).toHaveBeenCalledWith({
      manualUserContent: { "9": { text: "Dear Cy" } },
    });
  });
});

describe("importing per-user content from the clipboard", () => {
  it("asks before replacing text typed while the clipboard is read", async () => {
    let paste: (text: string) => void = () => {};
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: () =>
          new Promise<string>((resolve) => {
            paste = resolve;
          }),
      },
    });
    const perUser: CopyTextBlock = {
      ...plain,
      manualPerUser: true,
      manualUserContent: {},
    };
    const { rerender } = renderEditor(perUser);
    fireEvent.click(
      screen.getByRole("button", { name: "Import from clipboard…" }),
    );
    rerender({ ...perUser, manualUserContent: { "7": { text: "Dear Ana" } } });
    await act(async () => paste('{"7": "Hi Ana"}'));

    expect(
      screen.getByText("Overwrite existing per-user content?"),
    ).toBeTruthy();
  });
});
