import type { PercentCrop } from "react-image-crop";

export type Dimensions = {
  width: number;
  height: number;
};

type SourcePixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MAX_PREVIEW_SIZE = 1200;

const getRadianAngle = (degreeValue: number) => (degreeValue * Math.PI) / 180;

export const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

export const getCroppedImage = async (
  imageSrc: string,
  pixelCrop: SourcePixels,
  rotation: number,
) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to create canvas context");
  }

  const rotRad = getRadianAngle(rotation);
  const { width: imgWidth, height: imgHeight } = image;

  const boundWidth =
    Math.abs(Math.cos(rotRad) * imgWidth) +
    Math.abs(Math.sin(rotRad) * imgHeight);
  const boundHeight =
    Math.abs(Math.sin(rotRad) * imgWidth) +
    Math.abs(Math.cos(rotRad) * imgHeight);

  canvas.width = boundWidth;
  canvas.height = boundHeight;

  ctx.translate(boundWidth / 2, boundHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-imgWidth / 2, -imgHeight / 2);
  ctx.drawImage(image, 0, 0);

  const cropX = Math.round(pixelCrop.x);
  const cropY = Math.round(pixelCrop.y);
  const cropWidth = Math.round(pixelCrop.width);
  const cropHeight = Math.round(pixelCrop.height);

  const data = ctx.getImageData(cropX, cropY, cropWidth, cropHeight);

  canvas.width = cropWidth;
  canvas.height = cropHeight;

  ctx.putImageData(data, 0, 0);

  return canvas.toDataURL("image/png");
};

export const createPreviewImage = async (image: HTMLImageElement) => {
  const maxDimension = Math.max(image.width, image.height);
  if (maxDimension <= MAX_PREVIEW_SIZE) {
    return image.src;
  }
  const scale = MAX_PREVIEW_SIZE / maxDimension;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create canvas context");
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
};

export const rotateImageData = async (
  imageSrc: string,
  direction: "left" | "right",
) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to create canvas context");
  }

  const angle = direction === "left" ? -90 : 90;
  const rotRad = getRadianAngle(angle);
  const width = image.width;
  const height = image.height;

  canvas.width = height;
  canvas.height = width;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotRad);
  ctx.drawImage(image, -width / 2, -height / 2);

  return canvas.toDataURL("image/png");
};

export const toSourcePixels = (
  percentCrop: PercentCrop,
  dimensions: Dimensions,
): SourcePixels => ({
  x: (percentCrop.x / 100) * dimensions.width,
  y: (percentCrop.y / 100) * dimensions.height,
  width: (percentCrop.width / 100) * dimensions.width,
  height: (percentCrop.height / 100) * dimensions.height,
});
