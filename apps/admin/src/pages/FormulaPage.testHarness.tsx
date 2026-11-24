import type {
  FormulaDto,
  FormulaProblemDto,
  SaveFormulasDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach } from "bun:test";
import { createMemoryRouter, RouterProvider } from "react-router";
import FormulaPage from "./FormulaPage";

export const base: FormulaDto = {
  id: "00000000-0000-4000-8000-00000000000a",
  name: "base",
  text: "2",
  notes: null,
  versionId: 1,
  reads: [],
  updatedAt: "2026-11-19T00:00:00.000Z",
};
export const doubled: FormulaDto = {
  id: "00000000-0000-4000-8000-00000000000b",
  name: "doubled",
  text: "base * 2",
  notes: null,
  versionId: 2,
  reads: [base.id],
  updatedAt: "2026-11-19T00:00:00.000Z",
};
export const breaksDoubled: FormulaProblemDto = {
  kind: "named",
  id: doubled.id,
  text: "base * 2",
  diagnostics: [
    {
      message: "The left of this operator has to be a number.",
      start: 0,
      end: 4,
    },
  ],
};

export const api: {
  stored: FormulaDto[];
  saves: SaveFormulasDto[];
  answers: (FormulaProblemDto[] | number)[];
  listFails: boolean;
  listHeld: Promise<void> | undefined;
  listFetches: number;
} = {
  stored: [],
  saves: [],
  answers: [],
  listFails: false,
  listHeld: undefined,
  listFetches: 0,
};

export const serveFormulas = () => {
  serveApi(
    routes({
      "GET /formulas": async () => {
        api.listFetches += 1;
        await api.listHeld;
        return api.listFails
          ? Response.json({ message: "Unavailable" }, { status: 503 })
          : Response.json(api.stored);
      },
      "GET /formulas/:id/versions": () => Response.json([]),
      "POST /formulas/save": async ({ request }) => {
        const body: SaveFormulasDto = await request.json();
        api.saves.push(body);
        const answer = api.answers.shift() ?? [];
        if (typeof answer === "number") {
          return Response.json(
            {
              message:
                "`base` was changed since you opened it. Reload to see the latest version.",
            },
            { status: answer },
          );
        }
        if (answer.length === 0) {
          const deleted = new Set(body.deletions.map((each) => each.id));
          const edited = new Map(body.edits.map((each) => [each.id, each]));
          api.stored = [
            ...api.stored
              .filter((each) => !deleted.has(each.id) && !edited.has(each.id))
              .concat(
                body.edits.map((each) => ({
                  ...each,
                  versionId: 100 + api.saves.length,
                  reads: [],
                  updatedAt: "2026-11-20T00:00:00.000Z",
                })),
              ),
          ];
        }
        return Response.json({ problems: answer });
      },
    }),
  );

  beforeEach(() => {
    api.stored = [base, doubled];
    api.saves = [];
    api.answers = [];
    api.listFails = false;
    api.listHeld = undefined;
    api.listFetches = 0;
  });
};

export const renderPage = (path: string, cached?: FormulaDto[]) => {
  const router = createMemoryRouter(
    [
      { path: "/formulas", element: <p>All formulas</p> },
      { path: "/formulas/:formulaId", element: <FormulaPage /> },
    ],
    { initialEntries: [path] },
  );
  const query = queryWrapper();
  if (cached !== undefined) {
    query.client.setQueryData(queryKeys.formulasAdmin(), cached);
  }
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    query,
  );
  return { router, client: query.client };
};
export const typeText = (label: string, value: string, index = 0) =>
  fireEvent.change(screen.getAllByLabelText(new RegExp(`^${label}`))[index], {
    target: { value },
  });
