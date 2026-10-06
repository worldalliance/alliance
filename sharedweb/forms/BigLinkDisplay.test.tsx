import type { BigLinkBlock } from "@alliance/common/forms/display-blocks";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import BigLinkDisplay, {
  ShareLinkViewer,
  ShareLinkViewerProvider,
} from "./BigLinkDisplay";

afterEach(cleanup);

const BASE_URL = "https://example.com/survey";
const CODED_URL = "https://example.com/survey?Alliance_ID=abc123";

let shareLink: () => Response = () => Response.json({ url: CODED_URL });
const requestedTargets: unknown[] = [];

serveApi(
  routes({
    "POST /share-urls/get-share-link": async ({ request }) => {
      requestedTargets.push(await request.json());
      return shareLink();
    },
  }),
);

afterEach(() => {
  shareLink = () => Response.json({ url: CODED_URL });
  requestedTargets.length = 0;
});

const block = (overrides: Partial<BigLinkBlock> = {}): BigLinkBlock => ({
  type: "display",
  kind: "biglink",
  text: "Take the survey",
  url: BASE_URL,
  externalTargetId: 4,
  ...overrides,
});

const renderAs = (viewer: ShareLinkViewer, link: BigLinkBlock = block()) =>
  render(
    <MemoryRouter>
      <SiteAppProvider>
        <ShareLinkViewerProvider value={viewer}>
          <BigLinkDisplay block={link} />
        </ShareLinkViewerProvider>
      </SiteAppProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

const hrefOf = async (name: string) =>
  (await screen.findByRole("link", { name: new RegExp(name) })).getAttribute(
    "href",
  );

it("links a member to the target with their own code", async () => {
  renderAs(ShareLinkViewer.Member);

  expect(await hrefOf("Take the survey")).toBe(CODED_URL);
  expect(requestedTargets).toEqual([{ externalTargetId: 4 }]);
});

it("links anyone else to the target's base URL without asking for a code", async () => {
  renderAs(ShareLinkViewer.Anonymous);

  expect(await hrefOf("Take the survey")).toBe(BASE_URL);
  expect(requestedTargets).toEqual([]);
});

it("waits for sign-in before offering a link", () => {
  renderAs(ShareLinkViewer.Pending);

  expect(screen.getByText("Loading your link…")).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
});

it("says so when the member's link cannot be loaded", async () => {
  shareLink = () =>
    Response.json(
      { message: "specified share target not found", statusCode: 404 },
      { status: 404 },
    );
  renderAs(ShareLinkViewer.Member);

  expect(
    await screen.findByText("Couldn't load your link. Try again later."),
  ).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
});

it("follows a plain URL without needing a viewer", async () => {
  render(
    <MemoryRouter>
      <SiteAppProvider>
        <BigLinkDisplay block={block({ externalTargetId: undefined })} />
      </SiteAppProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

  expect(await hrefOf("Take the survey")).toBe(BASE_URL);
});

it("renders an icon this build does not know as the default", async () => {
  const unknownIcon = JSON.parse('"hash"');
  renderAs(ShareLinkViewer.Anonymous, block({ icon: unknownIcon }));

  expect(await hrefOf("Take the survey")).toBe(BASE_URL);
});
