import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useImageDropZone } from "./useImageDropZone";

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { isDragging, dropZoneProps } = useImageDropZone(onFiles);
  return (
    <div data-testid="zone" {...dropZoneProps}>
      {isDragging && "dragging"}
    </div>
  );
}

afterEach(cleanup);

const image = new File(["a"], "a.png", { type: "image/png" });
const imageDrag = {
  dataTransfer: {
    items: [{ kind: "file", type: "image/png" }],
    files: [image],
  },
};
const textDrag = {
  dataTransfer: { items: [{ kind: "file", type: "text/plain" }], files: [] },
};

it("shows the overlay only while an image is dragged over, through nested enters", () => {
  render(<DropZone onFiles={jest.fn()} />);
  const zone = screen.getByTestId("zone");

  fireEvent.dragEnter(zone, textDrag);
  expect(zone.textContent).toBe("");

  fireEvent.dragEnter(zone, imageDrag);
  fireEvent.dragEnter(zone, imageDrag);
  fireEvent.dragLeave(zone, imageDrag);
  expect(zone.textContent).toBe("dragging");

  fireEvent.dragLeave(zone, imageDrag);
  expect(zone.textContent).toBe("");
});

it("cancels dragover only for images, so the browser allows the drop", () => {
  render(<DropZone onFiles={jest.fn()} />);
  const zone = screen.getByTestId("zone");

  expect(fireEvent.dragOver(zone, imageDrag)).toBe(false);
  expect(fireEvent.dragOver(zone, textDrag)).toBe(true);
});

it("hands over the dropped files and clears the overlay", () => {
  const onFiles = jest.fn();
  render(<DropZone onFiles={onFiles} />);
  const zone = screen.getByTestId("zone");

  fireEvent.dragEnter(zone, imageDrag);
  fireEvent.drop(zone, imageDrag);

  expect(zone.textContent).toBe("");
  expect(onFiles).toHaveBeenCalledWith([image]);
});
