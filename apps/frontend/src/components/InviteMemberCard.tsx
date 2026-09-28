import { Features } from "@alliance/shared/lib/features";
import { getOnetimeInviteSignupUrl } from "@alliance/shared/lib/inviteUrls";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import Button from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback } from "react";
import { useAuth } from "../lib/AuthContext";
import { isFeatureEnabled } from "../lib/config";

const InviteMemberCard = () => {
  const { user } = useAuth();
  const { error: errorToast } = useToast();
  const referralLink =
    typeof window !== "undefined" && user?.referralCode
      ? getOnetimeInviteSignupUrl(getInviteBaseUrl(), user.referralCode)
      : "";

  const copyReferralLink = useCallback(async () => {
    if (
      user?.referralCode &&
      referralLink &&
      !(await copyToClipboard(referralLink))
    ) {
      errorToast("Could not copy the referral link.");
    }
  }, [user, referralLink, errorToast]);

  if (!isFeatureEnabled(Features.PublicSignup)) {
    if (!user?.admin) {
      return null;
    }
  }

  if (!user?.referralCode) return null;

  return (
    <Card>
      <div className="space-y-4">
        <p className="font-semibold">
          Invite a friend to become an Alliance member
        </p>
        <div className="space-y-2 flex flex-row flex-wrap gap-x-3 items-center">
          <p className=" text-gray-800 pt-3">Your referral link:</p>
          <div className="flex items-center space-x-2 flex-1">
            <code className="flex-1 px-3 py-3 bg-gray-100 rounded text-sm">
              {referralLink}
            </code>
            <Button onClick={copyReferralLink} className="active:bg-zinc-500">
              Copy
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default InviteMemberCard;
