import type { ActionPartnershipResponseDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { useOutreachPartnershipResponsesAdmin } from "./useOutreachPartnershipResponsesAdmin";

afterEach(cleanup);

const partnership = (id: number, organizationName: string) =>
  ({
    id,
    organizationName,
    organizationWebsite: "",
    personName: "Sam Example",
    contact: `org${id}@example.com`,
    outreachChannels: ["Newsletter"],
    outreachOtherDetails: "",
    audienceSize: "100",
    desiredCollaboration: "Share the action",
    notes: "",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    notesHistory: [],
  }) satisfies ActionPartnershipResponseDto;

const stored = [partnership(1, "Org A"), partnership(2, "Org B")];

serveApi(
  routes({
    "GET /action-partnerships/responses": () => Response.json(stored),
  }),
);

describe("useOutreachPartnershipResponsesAdmin", () => {
  it("loads the responses", async () => {
    const view = renderHook(
      () => useOutreachPartnershipResponsesAdmin(),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toEqual(stored));
  });
});
