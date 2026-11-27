import { imagesUploadImage } from "@alliance/shared/client";
import { useMutation } from "@tanstack/react-query";

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The file could not be read"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unreadable file"));
    reader.readAsDataURL(file);
  });

/** Uploads an image and gives its public URL. */
export function useImageUpload(params: { onSuccess: (url: string) => void }) {
  return useMutation({
    mutationFn: async (file: File) => {
      const { data } = await imagesUploadImage({
        body: { file: await readAsDataUrl(file) },
        throwOnError: true,
      });
      return data.url;
    },
    onSuccess: params.onSuccess,
    onError: (error) => console.error("Failed to upload image", error),
  });
}
