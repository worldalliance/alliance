import type { AnyField, FormValue } from "@alliance/common/forms/form-schema";
import type { FileUploadSlots } from "@alliance/shared/forms/fileUploadSlots";
import { resolveFormValue } from "@alliance/shared/forms/formValueUpdater";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { staticFieldContext } from "@alliance/shared/useFormRenderer";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import { RenderField } from "./RenderField";

serveApi(routes({}));

function Field({
  field,
  initial,
  fileUpload,
  onValue,
  isOutputView,
}: {
  field: AnyField;
  initial?: FormValue;
  fileUpload?: FileUploadSlots;
  onValue?: (value: FormValue | undefined) => void;
  isOutputView?: boolean;
}) {
  const [value, setValue] = useState<FormValue | undefined>(initial);
  onValue?.(value);
  return (
    <MemoryRouter>
      <SiteAppProvider>
        <RenderField
          field={field}
          value={value}
          fieldContext={staticFieldContext}
          onChange={(update) =>
            setValue((previous) => resolveFormValue(update, previous))
          }
          fileUpload={fileUpload}
          isOutputView={isOutputView}
        />
      </SiteAppProvider>
    </MemoryRouter>
  );
}

const uploads = (): FileUploadSlots => ({
  onFileSelected: jest.fn(async () => {}),
  cancelUpload: jest.fn(),
  uploadingSlotIds: new Set(),
  uploadErrors: {},
});

describe("toggle field", () => {
  const toggle: AnyField = {
    id: "email",
    type: "input",
    kind: "toggle",
    label: "Email notifications",
    required: true,
  };

  it("renders a switch named by its label", () => {
    render(<Field field={toggle} initial={true} />);

    const control = screen.getByRole<HTMLInputElement>("switch", {
      name: "Email notifications",
    });
    expect(control.checked).toBe(true);

    fireEvent.click(control);
    expect(control.checked).toBe(false);
  });

  it("is not marked optional, since off is an answer", () => {
    render(<Field field={{ ...toggle, required: false }} />);

    expect(screen.queryByText("Optional")).toBeNull();
  });

  it("leaves the checkbox field a checkbox", () => {
    render(<Field field={{ ...toggle, kind: "checkbox" }} />);

    expect(screen.queryByRole("switch")).toBeNull();
    expect(
      screen.getByRole("checkbox", { name: "Email notifications" }),
    ).toBeTruthy();
  });
});

describe("image upload field", () => {
  const image: AnyField = {
    id: "photo",
    type: "input",
    kind: "image",
    label: "Upload photo",
  };

  it("uploads the image picked through its labelled square", async () => {
    const fileUpload = uploads();
    const { container } = render(
      <Field field={image} fileUpload={fileUpload} />,
    );

    expect(screen.getByText("Optional")).toBeTruthy();
    const input = screen.getByLabelText("Upload photo");
    expect(input.getAttribute("accept")).toBe("image/*");
    expect(container.querySelector("img")).toBeNull();

    fireEvent.change(input, {
      target: { files: [new File(["x"], "me.png", { type: "image/png" })] },
    });

    await waitFor(() =>
      expect(fileUpload.onFileSelected).toHaveBeenCalledWith(
        { kind: "field", fieldId: "photo" },
        expect.stringMatching(/^data:image\/png;base64,/),
      ),
    );
  });

  it("shows the uploaded image in place of the silhouette", () => {
    const { container } = render(
      <Field field={image} initial="1700000000000-photo.webp" />,
    );

    expect(container.querySelector("img")?.getAttribute("src")).toMatch(
      /\/images\/1700000000000-photo\.webp$/,
    );
  });
});

describe("time picker field", () => {
  const wheel: AnyField = {
    id: "reminder",
    type: "input",
    kind: "timePicker",
    label: "Reminder time",
  };

  const shown = () =>
    ["Hour", "Minute", "AM or PM"].map((name) =>
      screen.getByRole("spinbutton", { name }).getAttribute("aria-valuetext"),
    );

  it("shows the answer on hour, minute and AM or PM wheels", () => {
    render(<Field field={wheel} initial="21:15" />);

    expect(screen.getByRole("group", { name: "Reminder time" })).toBeTruthy();
    expect(shown()).toEqual(["9", "15", "PM"]);
  });

  it("turns a wheel from the keyboard", () => {
    let answer: FormValue | undefined;
    render(
      <Field field={wheel} initial="21:15" onValue={(v) => (answer = v)} />,
    );

    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Hour" }), {
      key: "ArrowUp",
    });
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Minute" }), {
      key: "End",
    });

    expect(shown()).toEqual(["10", "45", "PM"]);
    expect(answer).toBe("22:45");
  });

  it("selects the row a scroll settles on", () => {
    jest.useFakeTimers();
    let answer: FormValue | undefined;
    render(
      <Field field={wheel} initial="09:00" onValue={(v) => (answer = v)} />,
    );
    const hour = screen.getByRole("spinbutton", { name: "Hour" });

    hour.scrollTop = 36 * 3;
    fireEvent.scroll(hour);
    act(() => jest.advanceTimersByTime(200));
    jest.useRealTimers();

    expect(answer).toBe("04:00");
  });

  it.each([
    ["the question", true, "When?", false, false],
    ["the required question", true, "When?", true, false],
    ["Optional alone", true, null, false, false],
    ["nothing when required", false, null, true, false],
    ["nothing in an output view", false, null, false, true],
  ])(
    "showing %s, leaves the gap under it: %p",
    (_shows, gap, label, required, isOutputView) => {
      const { container } = render(
        <Field
          field={{ ...wheel, label, required }}
          isOutputView={isOutputView}
        />,
      );

      const labelElement = container.querySelector("label");
      expect(labelElement?.classList.contains("mb-4")).toBe(gap);
    },
  );

  it("darkens the row under the band while the scroll is still moving", () => {
    render(<Field field={wheel} initial="09:00" />);
    const hour = screen.getByRole("spinbutton", { name: "Hour" });

    hour.scrollTop = 36 * 3;
    fireEvent.scroll(hour);

    expect(within(hour).getByText("4").className).toContain("text-zinc-900");
    expect(within(hour).getByText("9").className).toContain("text-zinc-600");
  });

  it("keeps a turn of one column when another column settles after it", () => {
    jest.useFakeTimers();
    let answer: FormValue | undefined;
    render(
      <Field field={wheel} initial="09:00" onValue={(v) => (answer = v)} />,
    );
    const hour = screen.getByRole("spinbutton", { name: "Hour" });
    const minute = screen.getByRole("spinbutton", { name: "Minute" });

    hour.scrollTop = 36 * 3;
    fireEvent.scroll(hour);
    act(() => jest.advanceTimersByTime(50));
    minute.scrollTop = 36 * 2;
    fireEvent.scroll(minute);
    act(() => jest.advanceTimersByTime(200));
    jest.useRealTimers();

    expect(answer).toBe("04:30");
  });

  it("shows 9:00 AM without answering for the member", () => {
    let answer: FormValue | undefined;
    render(<Field field={wheel} onValue={(v) => (answer = v)} />);

    expect(shown()).toEqual(["9", "00", "AM"]);
    expect(answer).toBeUndefined();
  });
});
