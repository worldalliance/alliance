import { thumbnailSrc } from "@alliance/common/image-src";
import { render, screen } from "@testing-library/react";
import { resolveImageSrc } from "../lib/imageSrc";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import RenderDisplayBlock from "./RenderDisplayBlock";

// The test DOM never loads an image, and the avatar shows its picture only
// once the image it preloads fires load.
const loadEveryImage = () =>
  jest.spyOn(window, "Image").mockImplementation(() => {
    const image = document.createElement("img");
    Object.defineProperty(image, "src", {
      set: () => queueMicrotask(() => image.dispatchEvent(new Event("load"))),
    });
    return image;
  });

it("shows a quote picture stored as an upload key from its url", async () => {
  loadEveryImage();
  const key = "1762925939234.webp";
  render(
    <SiteAppProvider>
      <RenderDisplayBlock
        block={{
          id: "q",
          type: "display",
          kind: "quote",
          text: "Hi",
          userId: 1,
          userProfilePicture: key,
        }}
      />
    </SiteAppProvider>,
  );
  const img = await screen.findByAltText<HTMLImageElement>("Profile");
  expect(img.getAttribute("src")).toBe(thumbnailSrc(resolveImageSrc(key)));
});
