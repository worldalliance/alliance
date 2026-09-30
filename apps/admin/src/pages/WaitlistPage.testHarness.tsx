import type {
  AdminWaitlistEntryDto,
  WaitlistEntrySearchDto,
} from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const allTags = [
  { id: 5, name: "Speakers", entryCount: 1 },
  { id: 6, name: "Hosts", entryCount: 0 },
];

type WaitlistApiState = {
  searches: WaitlistEntrySearchDto[];
  searchStatus: number;
  searchTotal: number;
  posts: { path: string; body: unknown }[];
  holdIds: Promise<void> | undefined;
  holdSearch: Promise<void> | undefined;
  mobilizeStatus: number;
  tagAddStatus: number;
  tagRenameStatus: number;
  tagCreateStatus: number;
  tagDeleteStatus: number;
  tagsStatus: number;
  tagsServed: typeof allTags;
  cohortsServed: {
    id: number;
    name: string;
    filter: object;
    updatedAt: string;
  }[];
  cohortCreateStatus: number;
};

const initialState = (): WaitlistApiState => ({
  searches: [],
  searchStatus: 200,
  searchTotal: 2,
  posts: [],
  holdIds: undefined,
  holdSearch: undefined,
  mobilizeStatus: 200,
  tagAddStatus: 200,
  tagRenameStatus: 200,
  tagCreateStatus: 200,
  tagDeleteStatus: 204,
  tagsStatus: 200,
  tagsServed: allTags,
  cohortsServed: [
    {
      id: 3,
      name: "Waiting",
      filter: { mobilized: false, search: null },
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
  ],
  cohortCreateStatus: 200,
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
            entry(2, {
              referrer: { id: 1, name: "Person 1" },
              tags: [{ id: 5, name: "Speakers" }],
            }),
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
      "GET /waitlist/admin/cohorts": () => Response.json(api.cohortsServed),
      "POST /waitlist/admin/cohorts": async ({ request }) => {
        if (api.cohortCreateStatus !== 200) {
          return Response.json(
            { message: "A cohort with that name already exists" },
            { status: api.cohortCreateStatus },
          );
        }
        const body: { name: string; filter: object } = await request.json();
        api.posts.push({ path: new URL(request.url).pathname, body });
        const created = {
          id: 4,
          ...body,
          updatedAt: "2026-09-02T00:00:00.000Z",
        };
        api.cohortsServed = [...api.cohortsServed, created];
        return Response.json(created);
      },
      "DELETE /waitlist/admin/cohorts/:id": ({ request, params }) => {
        api.posts.push({ path: new URL(request.url).pathname, body: null });
        api.cohortsServed = api.cohortsServed.filter(
          (cohort) => cohort.id !== Number(params.id),
        );
        return new Response(null, { status: 204 });
      },
      "PATCH /waitlist/admin/cohorts/:id": async ({ request, params }) => {
        const body: { filter: object } = await request.json();
        api.posts.push({ path: new URL(request.url).pathname, body });
        api.cohortsServed = api.cohortsServed.map((cohort) =>
          cohort.id === Number(params.id)
            ? { ...cohort, ...body, updatedAt: "2026-09-02T00:00:00.000Z" }
            : cohort,
        );
        return Response.json(
          api.cohortsServed.find((cohort) => cohort.id === Number(params.id)),
        );
      },
      "GET /waitlist/admin/tags": () =>
        api.tagsStatus === 200
          ? Response.json(api.tagsServed)
          : Response.json({}, { status: api.tagsStatus }),
      "POST /waitlist/admin/tags": async (input) =>
        api.tagCreateStatus === 200
          ? recordPost({ id: 9, name: "Donors" })(input)
          : Response.json(
              { message: "A tag with that name already exists" },
              { status: api.tagCreateStatus },
            ),
      "POST /waitlist/admin/tags/:id/add": async (input) =>
        api.tagAddStatus === 200
          ? recordPost({ changed: 2 })(input)
          : Response.json(
              { message: "Add refused" },
              { status: api.tagAddStatus },
            ),
      "POST /waitlist/admin/tags/:id/remove": recordPost({ changed: 1 }),
      "PATCH /waitlist/admin/tags/:id": async (input) =>
        api.tagRenameStatus === 200
          ? recordPost({ id: 6, name: "Co-hosts" })(input)
          : Response.json(
              { message: "A tag with that name already exists" },
              { status: api.tagRenameStatus },
            ),
      "DELETE /waitlist/admin/tags/:id": ({ request }) => {
        if (api.tagDeleteStatus !== 204) {
          return Response.json(
            { message: "Cohorts filter by this tag: Donors" },
            { status: api.tagDeleteStatus },
          );
        }
        api.posts.push({ path: new URL(request.url).pathname, body: null });
        return new Response(null, { status: 204 });
      },
    }),
  );
};

export const pickMenuItem = async (menu: string, item: string) => {
  fireEvent.click(screen.getByRole("button", { name: menu }));
  fireEvent.click(await screen.findByRole("menuitem", { name: item }));
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
