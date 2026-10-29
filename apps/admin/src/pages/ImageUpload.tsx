// eslint-disable-next-line api-client/named-hooks-only -- file upload; its result is used once, not cached
import { imagesUploadImage } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import React, { useState } from "react";
import { adminRefusalMessage } from "../lib/adminRefusal";

const ImageUpload: React.FC = () => {
  const [file, setFile] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setFile(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (file) {
      setError(null);
      try {
        const { data } = await imagesUploadImage({
          body: { file },
          throwOnError: true,
        });
        console.log(data);
        setKey(data.url);
      } catch (uploadError) {
        console.error("Failed to upload image", uploadError);
        setError(adminRefusalMessage(uploadError, "Failed to upload image."));
      }
    }
  };

  return (
    <div className="p-5 flex flex-col gap-4 items-start">
      <div>
        <h1 className="text-lg font-bold text-zinc-900">Image upload</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Upload an image to get a link you can paste anywhere.
        </p>
      </div>
      <input
        type="file"
        onChange={handleFileChange}
        className="text-sm cursor-pointer"
      />
      <Button color={ButtonColor.Black} onClick={handleUpload}>
        Upload
      </Button>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {key && (
        <div className="flex flex-col gap-2">
          <img
            src={key}
            alt="uploaded image"
            className="max-h-[300px] h-auto mr-auto"
          />
          <p>{key}</p>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
