import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ImageEditor from "./ImageEditor";

const INITIAL_URL = "data:image/png;base64,SU5JVElBTA==";
const CROPPED = "data:image/png;base64,Q1JPUFBFRA==";
const ROTATED = "data:image/png;base64,Uk9UQVRFRA==";

// happy-dom decodes nothing and has no canvas, so the source measurement, the
// preview downscale and the crop encode all have to be stubbed. The stub source
// stays under MAX_PREVIEW_SIZE, which keeps the preview at the source url and
// lets a test tell one loaded photo from another.
class StubImage {
  width = 600;
  height = 400;
  private url = "";
  private listeners: Record<string, (() => void)[]> = {};

  addEventListener(type: string, listener: () => void) {
    (this.listeners[type] ??= []).push(listener);
  }

  setAttribute() {}

  get src() {
    return this.url;
  }

  set src(url: string) {
    this.url = url;
    const event = decodeFails ? "error" : "load";
    const fire = () => this.listeners[event]?.forEach((listener) => listener());
    if (heldDecodes) heldDecodes.push(fire);
    else setTimeout(fire, 0);
  }
}

let decodeFails = false;
let cropRects: number[][] = [];
let encoded = CROPPED;
let angles: number[] = [];
let cropAngles: number[] = [];
// An array here holds every decode until a test releases it, which is how a
// rotation lands after the dismissal or the pick that was meant to drop it.
let heldDecodes: (() => void)[] | null = null;

const stubContext = {
  translate() {},
  rotate: (radians: number) => {
    angles.push(Math.round((radians * 180) / Math.PI));
  },
  drawImage() {},
  // Only the crop encode reads pixels back, and it turns the source to the
  // angle it crops at first, so the last angle is the one it drew at.
  getImageData: (x: number, y: number, width: number, height: number) => {
    cropAngles.push(angles.at(-1) ?? 0);
    cropRects.push([x, y, width, height]);
    return {};
  },
  putImageData() {},
};

const realImage = globalThis.Image;
const realGetContext = HTMLCanvasElement.prototype.getContext;
const realToDataURL = HTMLCanvasElement.prototype.toDataURL;

beforeEach(() => {
  decodeFails = false;
  cropRects = [];
  encoded = CROPPED;
  angles = [];
  cropAngles = [];
  heldDecodes = null;
  // @ts-expect-error minimal stand-in for the browser's Image
  globalThis.Image = StubImage;
  HTMLCanvasElement.prototype.getContext = (() => stubContext) as never;
  HTMLCanvasElement.prototype.toDataURL = (() => encoded) as never;
});

afterEach(() => {
  globalThis.Image = realImage;
  HTMLCanvasElement.prototype.getContext = realGetContext;
  HTMLCanvasElement.prototype.toDataURL = realToDataURL;
  cleanup();
});

const editor = (initialImageUrl: string | null, canRemove = false) => {
  const applied: (string | null)[] = [];
  render(
    <ImageEditor
      initialImageUrl={initialImageUrl}
      onChange={(image) => applied.push(image)}
      allowedMimeTypes={["image/png"]}
      canRemove={canRemove}
    />,
  );
  return applied;
};

const pick = (contents: string) => {
  const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
  const file = new File([contents], `${contents}.png`, { type: "image/png" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
};

const done = () => screen.getByRole("button", { name: "Done" });

const dragCorner = () => {
  const wrapper = document.querySelector(".ReactCrop__child-wrapper")!;
  wrapper.getBoundingClientRect = () =>
    ({ x: 0, y: 0, width: 600, height: 400 }) as DOMRect;
  fireEvent.pointerDown(wrapper, { clientX: 10, clientY: 10 });
  fireEvent.pointerMove(document, { clientX: 210, clientY: 210 });
  fireEvent.pointerUp(document, { clientX: 210, clientY: 210 });
};

// The crop starts centered on the preview's load, which happy-dom never fires.
const firePreviewLoad = async () => {
  const preview =
    await screen.findByAltText<HTMLImageElement>("Profile to crop");
  Object.defineProperty(preview, "width", { value: 600, configurable: true });
  Object.defineProperty(preview, "height", { value: 400, configurable: true });
  fireEvent.load(preview);
  return preview;
};

const loadPreview = async () => {
  const preview = await firePreviewLoad();
  await waitFor(() => expect(done().hasAttribute("disabled")).toBe(false));
  return preview;
};

// A `toBeNull` on the heading itself serializes the whole element on every
// retry, which is slow enough to spend the timeout before the modal closes.
const modalClosed = () =>
  waitFor(() => {
    if (screen.queryByText("Adjust your photo")) throw new Error("still open");
  });

const settled = () =>
  waitFor(() => {
    if (screen.queryByRole("status")) throw new Error("still processing");
  });

const dismiss = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await modalClosed();
};

const rotateRight = async () => {
  const previous = encoded;
  encoded = ROTATED;
  fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
  await waitFor(() =>
    expect(screen.getByAltText<HTMLImageElement>("Profile to crop").src).toBe(
      ROTATED,
    ),
  );
  encoded = previous;
  await loadPreview();
};

const apply = async () => {
  const encodes = cropAngles.length;
  fireEvent.click(done());
  await modalClosed();
  return cropAngles.slice(encodes);
};

const reopen = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Edit photo" }));
  await loadPreview();
};

const thumbnail = () =>
  screen.queryByAltText<HTMLImageElement>("Profile preview");

describe("ImageEditor", () => {
  test("encodes nothing until Done, then hands the caller one image", async () => {
    const applied = editor(INITIAL_URL);

    pick("first");
    await screen.findByText("Adjust your photo");
    expect(done().hasAttribute("disabled")).toBe(true);

    await loadPreview();
    expect(cropAngles).toEqual([]);
    expect(applied).toEqual([]);

    fireEvent.click(done());
    await waitFor(() => expect(applied).toEqual([CROPPED]));
    expect(cropAngles).toEqual([0]);
    expect(screen.queryByText("Adjust your photo")).toBeNull();
    expect(thumbnail()?.src).toBe(CROPPED);
  });

  test("keeps the caller's photo when a pick is dismissed", async () => {
    const applied = editor(INITIAL_URL);

    pick("first");
    await loadPreview();
    await dismiss();

    expect(applied).toEqual([]);
    expect(thumbnail()?.src).toBe(INITIAL_URL);
  });

  test("returns the editor to the applied photo when a pick is dismissed", async () => {
    const applied = editor(null);

    pick("first");
    const firstSrc = (await loadPreview()).src;
    fireEvent.click(done());
    await waitFor(() => expect(applied.length).toBe(1));

    pick("second");
    const secondSrc = (await loadPreview()).src;
    expect(secondSrc).not.toBe(firstSrc);
    await dismiss();

    fireEvent.click(screen.getByRole("button", { name: "Edit photo" }));
    const reopened =
      await screen.findByAltText<HTMLImageElement>("Profile to crop");
    expect(reopened.src).toBe(firstSrc);
  });

  test("offers the file picker again when a first pick is dismissed", async () => {
    editor(null);

    pick("first");
    await loadPreview();
    await dismiss();

    expect(thumbnail()).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit photo" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Upload photo" }),
    ).not.toBeNull();
  });

  test("keeps the rotation its photo was applied at when a later pick is dismissed", async () => {
    const applied = editor(null);

    pick("first");
    await loadPreview();
    await rotateRight();
    expect(await apply()).toEqual([90]);
    expect(applied).toEqual([CROPPED]);

    pick("second");
    await loadPreview();
    await dismiss();

    await reopen();
    expect(await apply()).toEqual([90]);
  });

  test("keeps the crop its photo was applied at when a pick is dismissed", async () => {
    editor(null);

    pick("first");
    await screen.findByAltText("Profile to crop");
    dragCorner();
    await loadPreview();
    await apply();
    expect(cropRects.at(-1)).toEqual([10, 10, 200, 200]);

    await reopen();
    await dismiss();

    await reopen();
    await apply();
    expect(cropRects.at(-1)).toEqual([10, 10, 200, 200]);
  });

  test("drops a rotation the user dismissed", async () => {
    editor(null);

    pick("first");
    await loadPreview();
    expect(await apply()).toEqual([0]);

    await reopen();
    await rotateRight();
    await dismiss();

    await reopen();
    expect(await apply()).toEqual([0]);
  });

  test("drops a rotation that lands after the dismissal", async () => {
    editor(null);

    pick("first");
    const firstSrc = (await loadPreview()).src;
    expect(await apply()).toEqual([0]);

    await reopen();
    heldDecodes = [];
    encoded = ROTATED;
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    await waitFor(() => expect(heldDecodes?.length).toBe(1));
    await dismiss();

    const held = heldDecodes ?? [];
    heldDecodes = null;
    angles = [];
    held.forEach((fire) => fire());
    await waitFor(() => expect(angles).toEqual([90]));
    encoded = CROPPED;

    await reopen();
    expect(screen.getByAltText<HTMLImageElement>("Profile to crop").src).toBe(
      firstSrc,
    );
    expect(await apply()).toEqual([0]);
  });

  test("drops a rotation that a new pick replaced", async () => {
    editor(null);

    pick("first");
    const firstSrc = (await loadPreview()).src;

    heldDecodes = [];
    encoded = ROTATED;
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    await waitFor(() => expect(heldDecodes?.length).toBe(1));

    pick("second");
    await waitFor(() => expect(heldDecodes?.length).toBe(2));

    const held = heldDecodes ?? [];
    heldDecodes = null;
    encoded = CROPPED;
    held.forEach((fire) => fire());
    const preview = await loadPreview();

    expect(preview.src).not.toBe(ROTATED);
    expect(preview.src).not.toBe(firstSrc);
    expect(await apply()).toEqual([0]);
  });

  test("clears the spinner when a dismissal leaves nothing to measure", async () => {
    editor(null);

    heldDecodes = [];
    pick("first");
    await screen.findByText("Adjust your photo");
    await waitFor(() => expect(heldDecodes?.length).toBe(1));
    await dismiss();

    // The dropped rotation has nothing left to build, so its spinner must come
    // off the button that picks the next photo rather than wait for the encode.
    expect(screen.queryByRole("status")).toBeNull();

    const held = heldDecodes ?? [];
    heldDecodes = null;
    held.forEach((fire) => fire());

    await settled();
  });

  test("keeps the spinner up for a measurement a dropped rotation outlived", async () => {
    editor(null);

    pick("first");
    await loadPreview();

    heldDecodes = [];
    encoded = ROTATED;
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    await waitFor(() => expect(heldDecodes?.length).toBe(1));

    pick("second");
    await waitFor(() => expect(heldDecodes?.length).toBe(2));

    const [rotation, measurement] = heldDecodes ?? [];
    heldDecodes = null;
    angles = [];
    encoded = CROPPED;
    rotation!();
    await waitFor(() => expect(angles).toEqual([90]));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryAllByRole("status").length).toBeGreaterThan(0);

    measurement!();
    await settled();
  });

  test("keeps the spinner up for a rotation a dropped rotation outlived", async () => {
    editor(null);

    pick("first");
    await loadPreview();
    await apply();

    await reopen();
    heldDecodes = [];
    encoded = ROTATED;
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    await waitFor(() => expect(heldDecodes?.length).toBe(1));
    await dismiss();

    encoded = CROPPED;
    await reopen();
    const rotate = () =>
      screen.getByRole<HTMLButtonElement>("button", { name: "Rotate right" });
    await waitFor(() => expect(rotate().disabled).toBe(false));

    fireEvent.click(rotate());
    await waitFor(() => expect(heldDecodes?.length).toBe(2));

    heldDecodes![0]!();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryAllByRole("status").length).toBeGreaterThan(0);
    expect(rotate().disabled).toBe(true);
  });

  test("clears the spinner when a removal leaves nothing to measure", async () => {
    heldDecodes = [];
    editor(INITIAL_URL, true);
    await waitFor(() => expect(heldDecodes?.length).toBe(1));

    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));

    await settled();
  });

  test("keeps Done disabled until a dismissal has re-measured its source", async () => {
    editor(null);

    pick("first");
    await loadPreview();
    expect(await apply()).toEqual([0]);

    await reopen();
    const firstSrc =
      screen.getByAltText<HTMLImageElement>("Profile to crop").src;
    pick("second");
    await waitFor(() =>
      expect(
        screen.getByAltText<HTMLImageElement>("Profile to crop").src,
      ).not.toBe(firstSrc),
    );
    await loadPreview();

    heldDecodes = [];
    encoded = ROTATED;
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    await waitFor(() => expect(heldDecodes?.length).toBe(1));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await modalClosed();
    await waitFor(() => expect(heldDecodes?.length).toBe(2));

    const [rotation, measurement] = heldDecodes ?? [];
    heldDecodes = null;
    encoded = CROPPED;
    rotation!();

    fireEvent.click(screen.getByRole("button", { name: "Edit photo" }));
    await firePreviewLoad();
    expect(done().hasAttribute("disabled")).toBe(true);

    measurement!();
    await waitFor(() => expect(done().hasAttribute("disabled")).toBe(false));
  });

  test("replaces the zero-size crop left by a click that never became a drag", async () => {
    editor(null);

    pick("first");
    await screen.findByAltText("Profile to crop");
    const wrapper = document.querySelector(".ReactCrop__child-wrapper")!;
    wrapper.getBoundingClientRect = () =>
      ({ x: 0, y: 0, width: 600, height: 400 }) as DOMRect;
    fireEvent.pointerDown(wrapper, { clientX: 100, clientY: 100 });
    expect(done().hasAttribute("disabled")).toBe(true);

    await loadPreview();
  });

  test("says so when the source will not decode", async () => {
    const applied = editor(null);
    decodeFails = true;

    pick("broken");
    await screen.findByText(
      "Unable to read this image. Please try another file.",
    );
    expect(done().hasAttribute("disabled")).toBe(true);
    expect(applied).toEqual([]);
  });

  test("says nothing when the caller's own photo will not decode", async () => {
    decodeFails = true;
    const applied = editor(INITIAL_URL);

    await settled();
    expect(
      screen.queryByText("Unable to read this image. Please try another file."),
    ).toBeNull();
    expect(applied).toEqual([]);
  });

  test("reports null when the user removes the photo", () => {
    const applied = editor(INITIAL_URL, true);

    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));

    expect(applied).toEqual([null]);
  });

  test("offers no remove control by default", () => {
    editor(INITIAL_URL);

    expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull();
  });

  test("does not offer back a photo the user removed", async () => {
    const applied = editor(INITIAL_URL, true);

    pick("first");
    await loadPreview();
    fireEvent.click(done());
    await waitFor(() => expect(applied).toEqual([CROPPED]));

    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(applied).toEqual([CROPPED, null]);

    pick("second");
    await loadPreview();
    await dismiss();

    expect(applied).toEqual([CROPPED, null]);
    expect(thumbnail()).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit photo" })).toBeNull();
  });

  test("keeps the modal open when the crop encodes past the size limit", async () => {
    const applied = editor(null);
    encoded = "d".repeat(50_000_001);

    pick("first");
    await loadPreview();
    fireEvent.click(done());

    await screen.findByText(/cropped image is too large/);
    expect(screen.queryByText("Adjust your photo")).not.toBeNull();
    expect(applied).toEqual([]);
  });
});
