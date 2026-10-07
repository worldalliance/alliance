import type { FormSchema } from "@alliance/common/forms/form-schema";
import { makeFormResponse, makeUser } from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import FormRenderer from "./FormRenderer";

const sourceSchema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [{ id: "companies", type: "input", kind: "text", label: "C" }],
    },
  ],
  outputViews: [],
};

const schema: FormSchema = {
  pages: [
    {
      id: "intro",
      fields: [{ id: "i", type: "display", kind: "text", text: "Intro" }],
    },
    {
      id: "leads",
      fields: [{ id: "l", type: "display", kind: "text", text: "Your leads" }],
      visibleIfFormula: {
        conditions: {
          condition1: {
            kind: "hasValue",
            when: "companies",
            hasValue: true,
            sourceFormId: 7,
          },
        },
        formula: "condition1",
      },
    },
    {
      id: "wrapUp",
      fields: [{ id: "w", type: "display", kind: "text", text: "Wrap up" }],
    },
  ],
  outputViews: [],
};

const storageKey = "form:1:1";

let answerSourceForm: () => void = () => {};

serveApi(
  routes({
    "GET /tasks/slug/:id": () => Response.json({ id: 7, schema: sourceSchema }),
    "GET /tasks/myResponse/:id": () =>
      new Promise<Response>((resolve) => {
        answerSourceForm = () =>
          resolve(
            Response.json(
              makeFormResponse({ formId: 7, answers: { companies: "Acme" } }),
            ),
          );
      }),
  }),
);

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <FormRenderer
            form={schema}
            id={1}
            formSnapshotId={1}
            actionId={1}
            onSubmit={async () => true}
            persistKey="1"
            user={makeUser()}
          />
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const savedPageIndex = () =>
  JSON.parse(window.localStorage.getItem(storageKey) ?? "{}").currentPageIndex;

const loadSourceAnswers = () =>
  act(async () => {
    answerSourceForm();
  });

describe("a page gated on another form's answers", () => {
  it("keeps a returning member on it while those answers load", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ formData: {}, currentPageIndex: 1 }),
    );
    renderForm();
    await act(async () => {});

    expect(savedPageIndex()).toBe(1);

    await loadSourceAnswers();

    expect(await screen.findByText("Your leads")).toBeTruthy();
    expect(savedPageIndex()).toBe(1);
  });

  it("is where Next goes, waiting for those answers before moving", async () => {
    renderForm();
    await act(async () => {});
    const next = screen.getByRole("button", { name: "Next" });

    fireEvent.click(next);
    await act(async () => {});

    expect(screen.getByText("Intro")).toBeTruthy();

    await loadSourceAnswers();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Your leads")).toBeTruthy();
  });
});
