import { R, type Result } from "@alliance/common/result";
import { forumExportPostAdmin } from "@alliance/shared/client";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";

const FALLBACK = "Couldn't download the post.";

async function fetchExport(
  postId: number,
): Promise<Result<{ blob: Blob; filename: string }, string>> {
  const fetched = await R.fromPromise(
    forumExportPostAdmin({
      path: { id: postId },
      parseAs: "blob",
      throwOnError: true,
    }),
    (error) => adminRefusalMessage(error, FALLBACK),
  );
  if (!fetched.ok) return fetched;
  const { data, response } = fetched.value;
  if (!(data instanceof Blob)) return R.failure(FALLBACK);
  const named = /filename="([^"]+)"/.exec(
    response.headers.get("content-disposition") ?? "",
  )?.[1];
  return R.success({ blob: data, filename: named ?? `post-${postId}.html` });
}

/** Saves the post, its comments and their attachments as one web page. */
export function useDownloadPost(postId: number) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setDownloading(true);
    setError(null);
    const result = await fetchExport(postId);
    setDownloading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const url = URL.createObjectURL(result.value.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.value.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return { download, downloading, error };
}
