import type {
  AdminWaitlistEntryDto,
  WaitlistEntrySearchDto,
} from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import WaitlistPage from "./WaitlistPage";

const entry = (
  id: number,
  fields: Partial<AdminWaitlistEntryDto> = {},
): AdminWaitlistEntryDto => ({
  id,
  name: `Person ${id}`,
  email: `person${id}@example.com`,
  reason: null,
  organization: null,
  sourceLink: null,
  referrer: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  mobilizedAt: null,
  unsubscribedAt: null,
  inviteState: "none",
  tags: [],
  ...fields,
});

const campaign = {
  code: "code",
  picture: null,
  communityId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

type WaitlistApiState = {
  searches: WaitlistEntrySearchDto[];
  searchStatus: number;
  searchTotal: number;
  posts: { path: string; body: unknown }[];
  holdIds: Promise<void> | undefined;
  holdSearch: Promise<void> | undefined;
  mobilizeStatus: number;
};

const initialState = (): WaitlistApiState => ({
  searches: [],
  searchStatus: 200,
  searchTotal: 2,
  posts: [],
  holdIds: undefined,
  holdSearch: undefined,
  mobilizeStatus: 200,
});

export const api = initialState();

const recordPost =
  (response: unknown) =>
  async ({ request }: { request: Request }) => {
    api.posts.push({
      path: new URL(request.url).pathname,
      body: await request.json(),
    });
    return Response.json(response);
  };

/** Call once at the top of a test file. */
export const serveWaitlistApi = () => {
  afterEach(cleanup);
  beforeEach(() => Object.assign(api, initialState()));
  serveApi(
    routes({
      "POST /waitlist/admin/entries/search": async ({ request }) => {
        await api.holdSearch;
        const body: WaitlistEntrySearchDto = await request.json();
        api.searches.push(body);
        if (api.searchStatus !== 200) {
          return Response.json({}, { status: api.searchStatus });
        }
        return Response.json({
          entries: [
            entry(1, { reason: "I care" }),
            entry(2, { referrer: { id: 1, name: "Person 1" } }),
          ],
          total: api.searchTotal,
        });
      },
      "POST /waitlist/admin/entries/ids": async (input) => {
        await api.holdIds;
        return recordPost({ ids: [1, 2, 3] })(input);
      },
      "POST /waitlist/admin/entries/mobilize": async (input) =>
        api.mobilizeStatus === 200
          ? recordPost({ changed: 1 })(input)
          : Response.json(
              { message: "Refused" },
              { status: api.mobilizeStatus },
            ),
      "POST /waitlist/admin/entries/unmobilize": recordPost({ changed: 0 }),
      "GET /campaigns": () =>
        Response.json([
          { ...campaign, id: 7, name: "Acme", kind: "organization" },
          { ...campaign, id: 8, name: "Spring drive", kind: "campaign" },
        ]),
      "GET /waitlist/admin/links": () =>
        Response.json([
          {
            id: 9,
            code: "news-code",
            organizationId: 7,
            channel: "Newsletter",
            publishedAt: null,
            archivedAt: null,
            createdAt: "2026-09-01T00:00:00.000Z",
            entryCount: 1,
          },
        ]),
    }),
  );
};

export const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <WaitlistPage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );
