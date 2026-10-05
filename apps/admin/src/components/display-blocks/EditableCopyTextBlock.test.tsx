import {
  CopyTextFormat,
  type CopyTextBlock,
} from "@alliance/common/forms/display-blocks";
import { pending, type Pending } from "@alliance/shared/lib/testing/pending";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { EditableCopyTextBlock } from "./EditableCopyTextBlock";

afterEach(cleanup);

let userList: () => Response | Promise<Response> = () => Response.json([]);

serveApi(routes({ "GET /user/list": () => userList() }));

afterEach(() => {
  userList = () => Response.json([]);
});

const renderEditor = (block: CopyTextBlock, onUpdate = jest.fn()) => {
  const query = queryWrapper();
  render(
    <ToastProvider>
      <SiteOriginLinkProvider origin="https://thealliance.org">
        <EditableCopyTextBlock
          block={block}
          onUpdate={onUpdate}
          onRemove={() => {}}
        />
      </SiteOriginLinkProvider>
    </ToastProvider>,
    query,
  );
  return { onUpdate, client: query.client };
};

const toggleFrom = (block: CopyTextBlock) => {
  const { onUpdate } = renderEditor(block);
  fireEvent.click(screen.getByRole("button", { name: "Rich text" }));
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
  it("renders a rich block's markdown", () => {
    renderEditor({
      ...plain,
      text: "Dear **council**",
      format: CopyTextFormat.Markdown,
    });

    fireEvent.click(screen.getByRole("button", { name: "Show preview" }));

    expect(screen.getByText("council").tagName).toBe("STRONG");
  });

  it("isn't offered for a plain block", () => {
    renderEditor(plain);

    expect(screen.queryByRole("button", { name: "Show preview" })).toBeNull();
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
  const openOptions = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Display block options" }),
    );

  it("says when the users fail to load and loads them on retry", async () => {
    userList = () => Response.json({}, { status: 500 });
    renderEditor(perUser);
    openOptions();

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
    openOptions();
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
});
