import { Banner } from "../ui/templates/Banner";

const REFERRAL_URL_PREVIEW =
  "https://alliance.example/actions/123?sid=member-code";

export function ReferralUrlNotice() {
  return (
    <Banner inline>
      <p className="font-medium">The member's referral link is always added</p>
      <p className="text-fg-muted">
        It is appended when the action is shared and can't be edited or removed
        here. It looks like{" "}
        <span className="font-mono text-xs break-all">
          {REFERRAL_URL_PREVIEW}
        </span>
        .
      </p>
    </Banner>
  );
}
