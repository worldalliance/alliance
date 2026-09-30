import { WaitlistEmailPlaceholder } from "@alliance/common/waitlistEmail";
import type { WaitlistEmailPreviewDto } from "@alliance/shared/client/types.gen";
import { describe, expect, it } from "bun:test";
import {
  blockingProblem,
  emailWarnings,
  sendConfirmation,
} from "./waitlistEmail";

const preview = (
  fields: Partial<WaitlistEmailPreviewDto> = {},
): WaitlistEmailPreviewDto => ({
  selected: 3,
  unsubscribed: 0,
  claimed: 0,
  recipientIds: [1, 2, 3],
  waiting: 2,
  withoutOrganization: 0,
  withoutGroup: 0,
  alreadySent: 0,
  sample: null,
  ...fields,
});

const uses = (...placeholders: WaitlistEmailPlaceholder[]) =>
  new Set(placeholders);

describe("blockingProblem", () => {
  it("blocks an email nobody would get", () => {
    expect(
      blockingProblem({ preview: preview({ recipientIds: [] }), used: uses() }),
    ).toMatch(/nobody/);
  });

  it("blocks #{organizationName} for recipients without one, only when used", () => {
    const withoutOrganization = preview({ withoutOrganization: 1 });
    expect(
      blockingProblem({
        preview: withoutOrganization,
        used: uses(WaitlistEmailPlaceholder.OrganizationName),
      }),
    ).toBe(
      "1 recipient has no organization for #{organizationName}. Change the text or the selection.",
    );
    expect(
      blockingProblem({ preview: withoutOrganization, used: uses() }),
    ).toBeNull();
  });
});

describe("emailWarnings", () => {
  it("warns of missing groups, with or without a signup link", () => {
    for (const used of [uses(WaitlistEmailPlaceholder.SignupLink), uses()]) {
      expect(
        emailWarnings({
          preview: preview({ withoutGroup: 2 }),
          used,
          includeClaimed: false,
        }),
      ).toEqual([
        "2 recipients have an organization without a group, so staff place them after they sign up.",
      ]);
    }
  });

  it("warns of repeat sends and included claimed invites", () => {
    expect(
      emailWarnings({
        preview: preview({ alreadySent: 1, claimed: 2 }),
        used: uses(WaitlistEmailPlaceholder.SignupLink),
        includeClaimed: true,
      }),
    ).toEqual([
      "1 recipient already got, or is getting, an email with this subject.",
      "2 recipients already claimed an invite and get a new one.",
    ]);
  });

  it("notes included claimed invites without a signup link", () => {
    expect(
      emailWarnings({
        preview: preview({ claimed: 1 }),
        used: uses(),
        includeClaimed: true,
      }),
    ).toEqual(["1 recipient already claimed an invite."]);
  });
});

describe("sendConfirmation", () => {
  it("says who is skipped and that statuses stay for a plain send", () => {
    expect(
      sendConfirmation({
        preview: preview({ unsubscribed: 1, claimed: 2 }),
        used: uses(),
        includeClaimed: false,
        subject: "News",
        mobilize: false,
      }),
    ).toBe(
      "Email “News” to 3 recipients now.\n\nSkips 1 unsubscribed and 2 who already claimed an invite.\n\nMobilized status stays as it is.",
    );
  });

  it("says when everyone mobilizing is already mobilized", () => {
    expect(
      sendConfirmation({
        preview: preview({ waiting: 0 }),
        used: uses(WaitlistEmailPlaceholder.SignupLink),
        includeClaimed: false,
        subject: "You're in",
        mobilize: true,
      }),
    ).toContain("Everyone is already mobilized and keeps their date.");
  });

  it("warns when mobilizing without a signup link", () => {
    const text = sendConfirmation({
      preview: preview(),
      used: uses(),
      includeClaimed: false,
      subject: "You're in",
      mobilize: true,
    });
    expect(text).toContain("Marks the 2 waiting as mobilized");
    expect(text).toContain(
      "This email has no #{signupLink}, so it accepts people without inviting them in it.",
    );
  });

  it("says a signup link issues invites", () => {
    const text = sendConfirmation({
      preview: preview(),
      used: uses(WaitlistEmailPlaceholder.SignupLink),
      includeClaimed: false,
      subject: "Join",
      mobilize: true,
    });
    expect(text).not.toContain("without inviting");
    expect(text).toContain(
      "Recipients without an unused invite get a new one.",
    );
  });
});
