import {
  koraResultsAnswers,
  koraResultsExports,
  koraResultsKoraExport,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery } from "@tanstack/react-query";

export function useKoraAnswersAdmin() {
  return useQuery({
    queryKey: queryKeys.koraAnswersAdmin(),
    queryFn: () =>
      koraResultsAnswers({ throwOnError: true }).then((r) => r.data),
  });
}

/** One export per line, as KORA reads them. */
export const exportsJsonl = (exports: Record<string, unknown>[]) =>
  exports.map((e) => JSON.stringify(e)).join("\n") +
  (exports.length ? "\n" : "");

export function useDownloadKoraExports(params: {
  onReady: (jsonl: string) => void;
  onError: (err: Error) => void;
}) {
  return useMutation({
    mutationFn: () =>
      koraResultsExports({ throwOnError: true }).then((r) =>
        exportsJsonl(r.data.exports),
      ),
    onSuccess: params.onReady,
    onError: params.onError,
  });
}

/** KORA's own export (docs/kora/kora_export.schema.yaml), as one JSON document. */
export function useDownloadKoraSpecExport(params: {
  onReady: (json: string) => void;
  onError: (err: Error) => void;
}) {
  return useMutation({
    mutationFn: (kind: "rolling" | "final") =>
      koraResultsKoraExport({ query: { kind }, throwOnError: true }).then(
        (r) => JSON.stringify(r.data, null, 2) + "\n",
      ),
    onSuccess: params.onReady,
    onError: params.onError,
  });
}
