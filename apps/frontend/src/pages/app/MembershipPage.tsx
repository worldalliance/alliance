import {
  getSignedMessage,
  getSuspensionMessage,
  WEEKLY_COMMITMENT_CONFIRMATION,
} from "@alliance/shared/lib/contract";
import {
  membershipAgreement,
  membershipAgreementLoadFailed,
  membershipFaq,
  signedAgreementLoadFailed,
  suspendContractConfirmation,
} from "@alliance/shared/lib/copy";
import { useMembershipAgreement } from "@alliance/shared/lib/useMembershipAgreement";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import React, { useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import AwayRangesSection from "../../components/AwayRangesSection";
import { ContractDescriptionList } from "../../components/ContractDescriptionList";
import LoadFailed from "../../components/LoadFailed";
import { useAuth } from "../../lib/AuthContext";
import { WalkthroughAnchor } from "../../onboarding/walkthrough/steps";

function SignedContractActions({
  message,
  onSuspend,
  isSubmitting,
}: {
  message: React.ReactNode;
  onSuspend: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="flex flex-col gap-y-3 sm:flex-row sm:items-center sm:justify-between border-t border-zinc-200 pt-5">
      {message}
      <Button
        onClick={onSuspend}
        color={ButtonColor.Red}
        disabled={isSubmitting}
      >
        {membershipAgreement.suspend}
      </Button>
    </div>
  );
}

const MembershipPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { hash } = useLocation();
  const {
    latestContract,
    contractLoadFailed,
    retryContractLoad,
    retryingContractLoad,
    lastContractEvent,
    signedName,
    setSignedName,
    confirmation,
    setConfirmation,
    isSubmitting,
    canSign,
    sign,
    suspend,
    previousSignedContract,
    previousContractLoadFailed,
    retryPreviousContractLoad,
    retryingPreviousContractLoad,
    latestSigned,
    updateAvailable,
  } = useMembershipAgreement({
    user,
    showError: (message) => alert(message),
  });

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!hash) {
      return;
    }
    const el = document.getElementById(hash.slice(1));
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [hash]);

  const handleContractSuspend = () => {
    if (window.confirm(suspendContractConfirmation)) {
      void suspend();
    }
  };

  const signedDateMessage = useMemo(() => {
    if (!lastContractEvent) {
      return null;
    }

    return (
      <p className="text-green">{getSignedMessage(lastContractEvent.date)}</p>
    );
  }, [lastContractEvent]);

  return (
    <CenterLayout>
      <div className="mb-6 relative flex flex-col gap-y-6">
        <h1 className="text-title">Membership</h1>

        {contractLoadFailed && (
          <Card style={CardStyle.White} className="p-6">
            <LoadFailed
              message={membershipAgreementLoadFailed}
              onRetry={retryContractLoad}
              retrying={retryingContractLoad}
            />
          </Card>
        )}

        {(previousSignedContract ||
          previousContractLoadFailed ||
          latestContract) && (
          <Card
            style={CardStyle.White}
            className="p-6"
            data-walkthrough={WalkthroughAnchor.Contract}
          >
            <h2 className="font-semibold! text-2xl! mb-4">
              {membershipAgreement.heading}
            </h2>
            <div className="flex flex-col gap-y-4">
              {previousContractLoadFailed && (
                <LoadFailed
                  message={signedAgreementLoadFailed}
                  onRetry={retryPreviousContractLoad}
                  retrying={retryingPreviousContractLoad}
                />
              )}
              {previousSignedContract && (
                <ContractDescriptionList
                  items={previousSignedContract.description}
                  markdown={previousSignedContract.markdown}
                >
                  <SignedContractActions
                    message={signedDateMessage}
                    onSuspend={handleContractSuspend}
                    isSubmitting={isSubmitting}
                  />
                </ContractDescriptionList>
              )}

              {latestContract && (
                <>
                  {updateAvailable && (
                    <p className="font-semibold">
                      {membershipAgreement.updateAvailable}
                    </p>
                  )}
                  <ContractDescriptionList
                    items={latestContract.description}
                    markdown={latestContract.markdown}
                  >
                    {latestSigned ? (
                      <SignedContractActions
                        message={signedDateMessage}
                        onSuspend={handleContractSuspend}
                        isSubmitting={isSubmitting}
                      />
                    ) : (
                      <div className="flex flex-col gap-y-4 border-zinc-200 border-t pt-5">
                        <h3 className="font-semibold">Signing</h3>
                        <div className="flex flex-col gap-y-2">
                          <p className="rounded border border-l-4 border-zinc-200 border-l-green bg-zinc-50 px-4 py-3 italic text-zinc-800">
                            {WEEKLY_COMMITMENT_CONFIRMATION}
                          </p>
                          <textarea
                            name="weeklyCommitmentConfirmation"
                            aria-label="Weekly commitment confirmation"
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            placeholder="Type the above statement here"
                            rows={2}
                            className="resize-y rounded border border-zinc-200 bg-white px-3 py-3 text-[11pt] transition-all duration-200 hover:border-zinc-300 focus:border-green focus:outline-none"
                          />
                          <div className="flex flex-col gap-y-3 sm:flex-row">
                            <FormInput
                              name="name"
                              type="text"
                              placeholder="Type your full name"
                              value={signedName}
                              onChange={(e) => setSignedName(e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              disabled={!canSign}
                              onClick={sign}
                              color={ButtonColor.Black}
                              className="h-auto! px-6 sm:ml-2"
                            >
                              Sign
                            </Button>
                          </div>
                          {lastContractEvent?.type === "suspended" && (
                            <Card style={CardStyle.Red} className="text-base">
                              <p>
                                {getSuspensionMessage(
                                  lastContractEvent.date,
                                  lastContractEvent.automatic,
                                )}
                              </p>
                            </Card>
                          )}
                        </div>
                      </div>
                    )}
                  </ContractDescriptionList>
                </>
              )}
            </div>
          </Card>
        )}

        <Card
          id="away-periods"
          data-walkthrough={WalkthroughAnchor.AwayRanges}
          style={CardStyle.White}
          className="p-6 scroll-mt-[calc(var(--navbar-top-bar-height)+1rem)]"
        >
          <AwayRangesSection />
        </Card>

        <Card style={CardStyle.White} className="p-6">
          <h2 className="font-semibold! text-2xl! mb-4">
            {membershipFaq.heading}
          </h2>
          <div className="flex flex-col gap-y-5">
            {membershipFaq.entries.map(({ question, answer, steps }) => (
              <div key={question} className="flex flex-col gap-y-1">
                <h3 className="flex items-center gap-x-2 font-semibold text-black">
                  {question}
                </h3>
                <p className="text-base">{answer}</p>
                {steps && (
                  <ol className="list-decimal list-outside pl-4 space-y-1">
                    {steps.map((step) => (
                      <li key={step} className="text-base">
                        {step}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </CenterLayout>
  );
};

export default MembershipPage;
