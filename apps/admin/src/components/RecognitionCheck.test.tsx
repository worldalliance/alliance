import type { RecognitionCheckDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  RecognitionCheck,
  RecognitionModeSelect,
} from "./ActionUpdateRecognition";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

let answer: () => Response = () => Response.json({});

serveApi(
  routes({
    "POST /actions/updates/:id/recognition-check": () => answer(),
  }),
);

const checkRecipients = () => {
  render(<RecognitionCheck updateId={3} disabledReason={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Check recipients" }));
};

const answering = (result: RecognitionCheckDto) => {
  answer = () => Response.json(result);
};

describe("RecognitionCheck", () => {
  it("says every copy resolves when nothing blocks the send", async () => {
    answering({ problems: [], members: [], collectiveSubject: "A hearing" });

    checkRecipients();

    expect(
      await screen.findByText(/Every recipient's copy resolves/),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("names each member whose contribution doesn't resolve, and each problem", async () => {
    answering({
      problems: ["Write the contribution formula."],
      members: [{ userId: 7, name: "Member7 Example", error: "no answer" }],
      collectiveSubject: "A hearing",
    });

    checkRecipients();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Write the contribution formula.");
    expect(alert.textContent).toContain("Member7 Example (#7): no answer");
    expect(screen.queryByText(/Every recipient's copy resolves/)).toBeNull();
  });

  it("shows the server's refusal and no result", async () => {
    answer = () =>
      Response.json(
        { statusCode: 400, message: "Update not found" },
        { status: 400 },
      );

    checkRecipients();

    expect(await screen.findByText("Update not found")).toBeTruthy();
    expect(
      screen.queryByText(/Collective result in email subjects/),
    ).toBeNull();
  });

  it("keeps a server error's own text out of the message", async () => {
    answer = () =>
      Response.json(
        { statusCode: 500, message: "Internal server error" },
        { status: 500 },
      );

    checkRecipients();

    expect(
      await screen.findByText("Couldn't check the recipients."),
    ).toBeTruthy();
  });

  it("says the check failed when the request doesn't go through", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    answer = () => {
      throw new TypeError("network down");
    };

    checkRecipients();

    expect(
      await screen.findByText("Couldn't check the recipients."),
    ).toBeTruthy();
  });

  it("explains why the check can't run yet, and doesn't run it", () => {
    render(
      <RecognitionCheck
        updateId={3}
        disabledReason="Save your changes before checking."
      />,
    );

    expect(screen.getByText("Save your changes before checking.")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Check recipients" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});

describe("RecognitionModeSelect", () => {
  it("reports the picked mode", () => {
    const onChange = jest.fn();
    render(
      <RecognitionModeSelect value="normal" onChange={onChange} className="" />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "retrospective" },
    });

    expect(onChange).toHaveBeenCalledWith("retrospective");
  });
});
