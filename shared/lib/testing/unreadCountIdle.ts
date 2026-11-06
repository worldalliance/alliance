import type { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { queryKeys } from "../queryKeys";

export const unreadCountIdle = (client: QueryClient) =>
  waitFor(() =>
    expect(
      client.getQueryState(queryKeys.notificationsUnreadCount())?.fetchStatus,
    ).toBe("idle"),
  );
