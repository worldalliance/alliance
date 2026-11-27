import { R, type Result } from "@alliance/common/result";
import { pending, type Pending } from "@alliance/shared/lib/testing/pending";
import * as uploadModule from "@alliance/shared/lib/uploadImageDataUri";
import * as readFileDataUriModule from "@alliance/sharedweb/lib/readFileDataUri";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { actionUpdateAdmin as update } from "../../../lib/testing/actionUpdateAdmin";
import { setupTaskUpdatePage } from "./taskUpdatePageHarness";

const { state, api, renderDetails } = setupTaskUpdatePage();

const useVolunteers = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Use Volunteers as the card image" }),
  );
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: "Save changes" });

let saved: Record<string, unknown>[] = [];
let uploads: Pending<Result<string, string>>[] = [];

beforeEach(() => {
  saved = [];
  uploads = [];
  state.served = update({
    schema: {
      blocks: [
        {
          type: "display",
          kind: "images",
          id: "b1",
          images: [{ src: "1793-volunteers.webp", alt: "Volunteers" }],
        },
      ],
    },
  });
  api.alsoServing({
    "PATCH /actions/updateUpdate/:id": async ({ request }) => {
      saved.push(await request.json());
      return Response.json(state.served);
    },
  });
  jest
    .spyOn(readFileDataUriModule, "readFileDataUri")
    .mockResolvedValue(R.success("data:image/png;base64,aaa"));
  jest
    .spyOn(uploadModule, "uploadImageDataUri")
    .mockImplementation((_dataUri, signal) => pending(uploads, signal));
});

afterEach(() => jest.restoreAllMocks());

describe("the Details tab's card image", () => {
  it("marks Details unsaved, drops on Discard, and saves with Details", async () => {
    await renderDetails();
    useVolunteers();
    expect(screen.getByAltText("Card image preview")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByAltText("Card image preview")).toBeNull();

    useVolunteers();
    fireEvent.click(saveButton());
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ cardImage: "1793-volunteers.webp" });
  });

  it("keeps the edits made while an upload was in flight", async () => {
    await renderDetails();
    fireEvent.change(screen.getByLabelText("Choose file…"), {
      target: { files: [new File(["x"], "card.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(uploads).toHaveLength(1));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Hearing moved" },
    });

    await act(async () => uploads[0]!.resolve(R.success("uploads/card.webp")));

    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Title" }).value,
    ).toBe("Hearing moved");
    expect(screen.getByText("Uploaded card.png")).toBeTruthy();
  });
});
