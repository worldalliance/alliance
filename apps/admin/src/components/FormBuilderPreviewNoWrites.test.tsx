import type { FormSchema } from "@alliance/common/forms/form-schema";
import { client } from "@alliance/shared/client/client.gen";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { previewing } from "../lib/testing/formCanvas";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";
import { isResponseCountsRead } from "../lib/testing/responseCounts";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [{ id: "name", type: "input", kind: "text", label: "Your name" }],
    },
    {
      id: "p2",
      fields: [
        { id: "why", type: "input", kind: "text", label: "Why you joined" },
      ],
    },
  ],
  outputViews: [],
};

const { baseUrl, fetch } = client.getConfig();
afterEach(() => client.setConfig({ baseUrl, fetch }));

it("sends nothing but reads while a previewed form is filled and submitted", async () => {
  const writes: string[] = [];
  client.setConfig({
    baseUrl: "http://localhost",
    fetch: async (request: Request) => {
      if (request.method !== "GET" && !isResponseCountsRead(request)) {
        writes.push(`${request.method} ${new URL(request.url).pathname}`);
      }
      const { pathname } = new URL(request.url);
      if (pathname === "/user/list") {
        return Response.json([makeUser({ id: 7, name: "Ana" })]);
      }
      return Response.json([]);
    },
  });
  renderFormBuilder(schema);
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  await waitFor(() => expect(previewing()).toBe(true));

  fireEvent.change(await screen.findByLabelText("Your name"), {
    target: { value: "Sam" },
  });
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  fireEvent.change(await screen.findByLabelText("Why you joined"), {
    target: { value: "Because" },
  });
  fireEvent.click(screen.getByRole("button", { name: /\(Preview Mode\)/ }));
  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(writes).toEqual([]);
});
