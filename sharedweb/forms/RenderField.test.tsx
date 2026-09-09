import type { ListSubField } from "@alliance/common/forms/form-schema";
import { CARD_ID_KEY } from "@alliance/shared/forms/listCards";
import { PreviewModeProvider } from "@alliance/shared/forms/previewMode";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { imageSrcFromKey } from "../lib/imageSrc";
import RenderField from "./RenderField";
import RenderPreviousAnswer from "./RenderPreviousAnswer";

afterEach(cleanup);

const previewing = (node: ReactNode) =>
  render(<PreviewModeProvider value={true}>{node}</PreviewModeProvider>);

const dataUri = "data:image/png;base64,iVBORw0KGgo=";

const photo: ListSubField = {
  kind: "file",
  type: "input",
  id: "photo",
  label: "Photo",
};

const imageSrc = () => screen.getByAltText("Uploaded file").getAttribute("src");

describe("a previewed file field", () => {
  it("renders the picked file from its data uri", () => {
    previewing(<RenderField field={photo} value={dataUri} />);

    expect(imageSrc()).toBe(dataUri);
  });

  it("renders it the same way inside a list card", () => {
    previewing(
      <RenderField
        field={{
          kind: "list",
          type: "input",
          id: "pets",
          label: "Pets",
          fields: [photo],
        }}
        value={[{ [CARD_ID_KEY]: "card-1", photo: dataUri }]}
      />,
    );

    expect(imageSrc()).toBe(dataUri);
  });

  it("leaves a stored answer under the api, data uri or not", () => {
    previewing(
      <RenderPreviousAnswer
        block={{
          kind: "previousAnswer",
          type: "display",
          sourceFormId: 1,
          sourceFieldId: "photo",
          showLabel: true,
        }}
        schema={{ pages: [{ id: "page-1", fields: [photo] }], outputViews: [] }}
        answers={{ photo: dataUri }}
      />,
    );

    expect(imageSrc()).toBe(imageSrcFromKey(dataUri));
  });
});
