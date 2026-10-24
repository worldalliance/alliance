import {
  formSchema,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { z } from "zod";
import { openSection, selectElement } from "../lib/testing/formCanvas";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";
import { resetCustomValidatorsCache } from "./form-fields/useCustomValidators";

const withList: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        {
          type: "input",
          kind: "list",
          id: "l",
          label: "L",
          fields: [{ type: "input", kind: "text", id: "sub", label: "S" }],
        },
      ],
    },
  ],
  outputViews: [],
};

describe("FormBuilder save with a draft validator", () => {
  const saved: FormSchema[] = [];
  let validatorLoads = 0;
  beforeEach(() => {
    resetCustomValidatorsCache();
    saved.length = 0;
    validatorLoads = 0;
  });
  serveApi(
    routes({
      "GET /tasks/listForms": () => Response.json([]),
      "GET /tasks/customValidators": () =>
        Response.json([
          {
            name: "Has phone number",
            id: "HasPhoneNumber",
            withIdField: false,
            usableForVisibility: true,
          },
        ]),
      "POST /tasks/createCustomValidator": () => Response.json({ id: 42 }),
      "GET /tasks/findOneCustomValidator/:id": () => {
        validatorLoads += 1;
        return Response.json({
          id: 42,
          type: "HasPhoneNumber",
          idArgument: null,
          expression: null,
        });
      },
      "PUT /tasks/updateForm/:formId": async ({ request }) => {
        saved.push(
          z.object({ schema: formSchema }).parse(await request.json()).schema,
        );
        return Response.json({ id: 1, formSnapshotId: 2 });
      },
    }),
  );

  const saveWithDraftValidator = async () => {
    renderFormBuilder(withList, 1);

    selectElement("Text Field: S");
    openSection("Advanced");
    fireEvent.click(screen.getByLabelText("Use custom validator"));
    const option = await screen.findByRole("option", {
      name: "Has phone number",
    });
    const select = option.closest("select");
    if (!select) throw new Error("validator option outside a select");
    fireEvent.change(select, { target: { value: "HasPhoneNumber" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save Form" }));
    });
    await waitFor(() => expect(saved).toHaveLength(1));
  };

  it("saves a list sub-field's draft validator under its created id", async () => {
    await saveWithDraftValidator();

    const list = saved[0].pages[0].fields[0];
    expect(list.kind === "list" && list.fields[0].customValidatorId).toBe(42);
  });

  it("keeps showing a validator Save created without loading it", async () => {
    await saveWithDraftValidator();

    expect(screen.getByDisplayValue("Has phone number")).toBeTruthy();
    expect(validatorLoads).toBe(0);
  });
});
