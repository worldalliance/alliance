import {
  QueryClient,
  QueryClientProvider,
  type DefaultOptions,
} from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

export const queryWrapper = (queries?: DefaultOptions["queries"]) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, ...queries } },
  });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children),
  };
};
