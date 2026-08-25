import { R, type Result } from "@alliance/common/result";
import {
  launchImageLibraryAsync,
  type ImagePickerAsset,
  type ImagePickerOptions,
} from "expo-image-picker";

export type PickedImage = {
  uri: string;
  /** `data:<mime>;base64,<...>`, the shape the images endpoint accepts. */
  dataUri: string;
};

type PickOptions = Pick<ImagePickerOptions, "allowsEditing" | "quality">;

function assetDataUri(asset: ImagePickerAsset): string | null {
  if (!asset.base64) {
    return null;
  }
  return `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`;
}

async function pickAssets(
  options: ImagePickerOptions,
): Promise<Result<ImagePickerAsset[], Error>> {
  const result = await R.fromPromise(launchImageLibraryAsync(options));
  if (!result.ok) {
    return R.failure(result.error);
  }
  return R.success(result.value.canceled ? [] : result.value.assets);
}

/** Returns `null` when the user cancels. */
export async function pickImageDataUri(
  options?: PickOptions,
): Promise<Result<PickedImage | null, Error>> {
  const assets = await pickAssets({
    mediaTypes: ["images"],
    quality: 0.8,
    ...options,
    base64: true,
  });
  if (!assets.ok) {
    return R.failure(assets.error);
  }
  if (assets.value.length === 0) {
    return R.success(null);
  }

  const asset = assets.value[0];
  const dataUri = assetDataUri(asset);
  if (!dataUri) {
    return R.failure(new Error("Picked image had no readable data"));
  }
  return R.success({ uri: asset.uri, dataUri });
}

export type PickedImages = {
  dataUris: string[];
  unreadableCount: number;
};

/** Cancellation returns an empty list. */
export async function pickImageDataUris(
  options?: Pick<ImagePickerOptions, "quality">,
): Promise<Result<PickedImages, Error>> {
  const assets = await pickAssets({
    mediaTypes: ["images"],
    quality: 0.8,
    ...options,
    allowsMultipleSelection: true,
    base64: true,
  });
  if (!assets.ok) {
    return R.failure(assets.error);
  }
  const dataUris = assets.value
    .map(assetDataUri)
    .filter((dataUri): dataUri is string => dataUri !== null);
  return R.success({
    dataUris,
    unreadableCount: assets.value.length - dataUris.length,
  });
}
