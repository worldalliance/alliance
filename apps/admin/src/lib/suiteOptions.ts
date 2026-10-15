import type { ActionSuiteDto } from "@alliance/shared/client";

export function suiteOptions(params: {
  suites: ActionSuiteDto[];
  loading: boolean;
  failed: boolean;
}) {
  const { suites, loading, failed } = params;
  return [
    {
      value: "",
      label: loading
        ? "Loading suites..."
        : failed
          ? "Failed to load suites"
          : "No suite",
    },
    ...suites.map((suite) => ({ value: suite.id, label: suite.name })),
  ];
}
