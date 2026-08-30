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
    const fire = () => this.listeners["load"]?.forEach((listener) => listener());
    if (heldDecodes) heldDecodes.push(fire);
    else setTimeout(fire, 0);
  }
}

let encoded = CROPPED;
let angles: number[] = [];
let cropAngles: number[] = [];
// An array here holds every decode until a test releases it, which is how a
// rotation lands after the pick that was meant to drop it.
let heldDecodes: (() => void)[] | null = null;

const stubContext = {
  translate() {},
  rotate: (radians: number) => {
    angles.push(Math.round((radians * 180) / Math.PI));
  },
  drawImage() {},
  // Only the crop encode reads pixels back, and it turns the source to the
  // angle it crops at first, so the last angle is the one it drew at.
  getImageData: () => {
    cropAngles.push(angles.at(-1) ?? 0);
    return {};
  },
  putImageData() {},
};

const realImage = globalThis.Image;
const realGetContext = HTMLCanvasElement.prototype.getContext;
const realToDataURL = HTMLCanvasElement.prototype.toDataURL;

beforeEach(() => {
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

// The crop starts centered on the preview's load, which happy-dom never fires.
const firePreviewLoad = async () => {
  const preview =
    await screen.findByAltText<HTMLImageElement>("Profile to crop");
  Object.defineProperty(preview, "width", { value: 600, configurable: true });
  Object.defineProperty(preview, "height", { value: 400, configurable: true });
  fireEvent.load(preview);
  return preview;
};

const settled = () =>
  waitFor(() => {
    if (screen.queryByRole("status")) throw new Error("still processing");
  });

describe("ImageEditor", () => {
  test("reports nothing for a pick whose crop never lands", async () => {
    const applied = editor(INITIAL_URL);

    pick("first");
    await screen.findByText("Adjust your photo");
    await settled();

    expect(applied).toEqual([]);
  });

  test("drops a rotation that a new pick replaced", async () => {
    editor(null);

    pick("first");
    const firstSrc = (await firePreviewLoad()).src;
    await waitFor(() => expect(cropAngles).toEqual([0]));

    heldDecodes = [];
    encoded = ROTATED;
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    await waitFor(() => expect(heldDecodes?.length).toBe(1));

    pick("second");
    await waitFor(() => expect(heldDecodes?.length).toBe(2));
    cropAngles = [];

    const held = heldDecodes ?? [];
    heldDecodes = null;
    encoded = CROPPED;
    held.forEach((fire) => fire());
    const preview = await firePreviewLoad();
    await waitFor(() => expect(cropAngles).toEqual([0]));

    expect(preview.src).not.toBe(ROTATED);
    expect(preview.src).not.toBe(firstSrc);
  });

  test("drops a rotation that a removal replaced", async () => {
    editor(null, true);

    pick("first");
    await firePreviewLoad();
    await waitFor(() => expect(cropAngles).toEqual([0]));

    heldDecodes = [];
    encoded = ROTATED;
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    await waitFor(() => expect(heldDecodes?.length).toBe(1));

    // The open modal marks the thumbnail inert, so closing it is what puts the
    // remove button back within reach.
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));

    // The dropped rotation has nothing left to build, so its spinner must come
    // off the button that picks the next photo rather than wait for the encode.
    expect(screen.queryByRole("status")).toBeNull();

    const held = heldDecodes ?? [];
    heldDecodes = null;
    held.forEach((fire) => fire());
    await settled();

    expect(screen.queryByAltText("Profile preview")).toBeNull();
  });

  test("keeps the spinner up for a measurement a dropped rotation outlived", async () => {
    editor(null);

    pick("first");
    await firePreviewLoad();
    await waitFor(() => expect(cropAngles).toEqual([0]));

    angles = [];
    heldDecodes = [];
    encoded = ROTATED;
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    await waitFor(() => expect(heldDecodes?.length).toBe(1));

    pick("second");
    await waitFor(() => expect(heldDecodes?.length).toBe(2));

    const [rotation, measurement] = heldDecodes ?? [];
    heldDecodes = null;
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
    editor(null, true);

    pick("first");
    await firePreviewLoad();
    await waitFor(() => expect(cropAngles).toEqual([0]));

    heldDecodes = [];
    encoded = ROTATED;
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    await waitFor(() => expect(heldDecodes?.length).toBe(1));

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));

    encoded = CROPPED;
    pick("second");
    await waitFor(() => expect(heldDecodes?.length).toBe(2));

    await act(async () => {
      heldDecodes![1]!();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await firePreviewLoad();
    const rotate = () =>
      screen.getByRole<HTMLButtonElement>("button", { name: "Rotate right" });
    await waitFor(() => expect(rotate().disabled).toBe(false));

    const beforeSecondRotation = heldDecodes!.length;
    fireEvent.click(rotate());
    await waitFor(() =>
      expect(heldDecodes!.length).toBeGreaterThan(beforeSecondRotation),
    );

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

  test("reports null when the user removes the photo", () => {
    const applied = editor(INITIAL_URL, true);

    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));

    expect(applied).toEqual([null]);
  });

  test("offers no remove control by default", () => {
    editor(INITIAL_URL);

    expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull();
  });
});
