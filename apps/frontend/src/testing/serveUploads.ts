import type {
  UploadImageDto,
  UploadImageResponseDto,
} from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";

export const uploads: string[] = [];

let pending: Promise<void> | null = null;
let failure: string | null = null;

/** Holds every upload in this test open until the returned callback runs. */
export const deferUpload = (): (() => void) => {
  let release = () => {};
  pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  return release;
};

export const failUploads = (message: string) => {
  failure = message;
};

/** Serves the upload endpoint, where a data url comes back as a key. Call at
 * file scope. */
export const serveUploads = () => {
  serveApi(
    routes({
      "POST /images/uploadImage": async ({ request }) => {
        const { file } = (await request.json()) as UploadImageDto;
        const key = `key-${uploads.length}`;
        uploads.push(file);
        if (pending) await pending;
        return failure
          ? Response.json({ message: failure }, { status: 400 })
          : Response.json({
              key,
              url: `https://uploads.test/${key}`,
            } satisfies UploadImageResponseDto);
      },
    }),
  );
  beforeEach(() => {
    uploads.length = 0;
    pending = null;
    failure = null;
  });
};
