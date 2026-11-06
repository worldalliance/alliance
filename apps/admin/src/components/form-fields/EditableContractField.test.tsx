import type { ContractField } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { waitFor } from "@testing-library/react";
import { renderInEditorSidebar } from "../../lib/testing/renderInEditorSidebar";
import { EditableContractField } from "./EditableContractField";

serveApi(
  routes({
    "GET /contract/current": () =>
      Response.json({ id: 7, name: "Pledge", markdown: "I pledge" }),
    "GET /contract/admin": () =>
      Response.json([{ id: 7, name: "Pledge", markdown: "I pledge" }]),
  }),
);

const field: ContractField = {
  id: "pledge",
  type: "input",
  kind: "contract",
  label: "Contract Field",
  required: false,
  contractId: null,
  signQuestion: "Sign the contract?",
  yesLabel: "Yes",
  noLabel: "No",
};

it("writes the default again when it rerenders with the contract still missing", async () => {
  const editor = (onUpdate: (updates: Partial<ContractField>) => void) => (
    <EditableContractField field={field} onUpdate={onUpdate} />
  );
  const first = jest.fn();
  const { rerender } = renderInEditorSidebar(editor(first));
  await waitFor(() => expect(first).toHaveBeenCalledWith({ contractId: 7 }));

  const onUpdate = jest.fn();
  rerender(editor(onUpdate));
  await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ contractId: 7 }));
});
