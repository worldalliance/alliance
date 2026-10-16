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
import { ChevronDown } from "lucide-react-native";
import { useMemo, useState, type ReactNode } from "react";
import { Alert, TextInput, TouchableOpacity, View } from "react-native";
import AppMarkdownWrapper from "../../components/AppMarkdownWrapper";
import AwayRangesSection from "../../components/AwayRangesSection";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import LoadFailed from "../../components/LoadFailed";
import Button, { ButtonColor } from "../../components/system/Button";
import Card, { CardStyle } from "../../components/system/Card";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../components/system/Text";
import { useAuth } from "../../lib/AuthContext";
import {
  Anchor,
  useWalkthroughScroll,
  WalkthroughAnchor,
} from "../../lib/onboarding/walkthrough";
import { colors } from "../../lib/style/colors";

function FormalTextDropdown({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false);

  return (
    <View className="gap-y-2">
      <TouchableOpacity
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Full text"
        className="flex-row items-center gap-1 self-start"
      >
        <Text className="text-sm text-zinc-500">Full text</Text>
        <ChevronDown
          size={14}
          color={colors.text.icon}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </TouchableOpacity>
      {open && (
        <View className="rounded bg-zinc-100 px-3 py-3">
          <AppMarkdownWrapper small>{markdown}</AppMarkdownWrapper>
        </View>
      )}
    </View>
  );
}

function ContractDescriptionList({
  items,
  markdown,
  children,
}: {
  items?: { point: string; subtext: string }[];
  markdown: string;
  children?: ReactNode;
}) {
  if (!items?.length && markdown.trim() === "" && !children) return null;
  return (
    <View className="gap-y-5">
      {items?.map((item, index) => (
        <View key={index} className="flex-row gap-x-4">
          <View className="h-8 w-8 shrink-0 items-center justify-center rounded bg-black">
            <Text
              className="text-lg leading-none text-white"
              weight={FontWeight.Semibold}
            >
              {index + 1}
            </Text>
          </View>
          <View className="flex-1 gap-y-1">
            <View>
              <AppMarkdownWrapper>{item.point}</AppMarkdownWrapper>
            </View>
            {item.subtext.trim() !== "" && (
              <AppMarkdownWrapper>{item.subtext}</AppMarkdownWrapper>
            )}
          </View>
        </View>
      ))}
      {markdown.trim() !== "" && <FormalTextDropdown markdown={markdown} />}
      {children}
    </View>
  );
}

function SignedContractActions({
  message,
  onSuspend,
  isSubmitting,
}: {
  message: ReactNode;
  onSuspend: () => void;
  isSubmitting: boolean;
}) {
  return (
    <View className="gap-y-3 border-t border-zinc-200 pt-5">
      {message}
      <Button
        onPress={onSuspend}
        color={ButtonColor.Red}
        disabled={isSubmitting}
        loading={isSubmitting}
        title={membershipAgreement.suspend}
      />
    </View>
  );
}

export default function MembershipScreen() {
  const { user, refreshUser } = useAuth();
  const walkthroughScroll = useWalkthroughScroll();
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
    refreshUser,
    showError: (message) => Alert.alert("Error", message),
  });

  const handleContractSuspend = () => {
    Alert.alert(membershipAgreement.suspend, suspendContractConfirmation, [
      { text: "Cancel", style: "cancel" },
      { text: "Suspend", style: "destructive", onPress: suspend },
    ]);
  };

  const signedContractMessage = useMemo(() => {
    if (!lastContractEvent) return null;
    return (
      <Text className="text-green" weight={FontWeight.Medium}>
        {getSignedMessage(lastContractEvent.date)}
      </Text>
    );
  }, [lastContractEvent]);

  if (!user) {
    return (
      <View className="flex-1 p-4" style={{ backgroundColor: colors.grey[0] }}>
        <Text className="text-center text-zinc-500">Not found</Text>
      </View>
    );
  }

  const inputClasses =
    "border border-zinc-200 rounded bg-white px-3 py-3 text-base flex-1 min-h-12";

  return (
    <View className="flex-1" style={{ backgroundColor: colors.grey[0] }}>
      <SimplePageTitle title="Membership" />
      <KeyboardAwareScrollView
        testID="vr-membership-ready"
        {...walkthroughScroll}
      >
        <View className="px-2 pb-8 pt-2 flex flex-col gap-2">
          {lastContractEvent?.type === "suspended" && (
            <Card cardStyle={CardStyle.Red}>
              <Text>
                {getSuspensionMessage(
                  lastContractEvent.date,
                  lastContractEvent.automatic,
                )}
              </Text>
            </Card>
          )}

          {contractLoadFailed && (
            <Card cardStyle={CardStyle.White}>
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
            <Anchor name={WalkthroughAnchor.Contract}>
              <Card cardStyle={CardStyle.White}>
                <Text className="text-2xl mb-4" weight={FontWeight.Semibold}>
                  {membershipAgreement.heading}
                </Text>
                <View className="gap-y-4">
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
                        message={signedContractMessage}
                        onSuspend={handleContractSuspend}
                        isSubmitting={isSubmitting}
                      />
                    </ContractDescriptionList>
                  )}

                  {latestContract && (
                    <>
                      {updateAvailable && (
                        <Text weight={FontWeight.Semibold}>
                          {membershipAgreement.updateAvailable}
                        </Text>
                      )}
                      <ContractDescriptionList
                        items={latestContract.description}
                        markdown={latestContract.markdown}
                      >
                        {latestSigned ? (
                          <SignedContractActions
                            message={signedContractMessage}
                            onSuspend={handleContractSuspend}
                            isSubmitting={isSubmitting}
                          />
                        ) : (
                          <View className="gap-y-4 border-t border-zinc-200 pt-5">
                            <View className="gap-y-1">
                              <Text
                                className="text-zinc-900"
                                weight={FontWeight.Semibold}
                              >
                                Signing
                              </Text>
                            </View>

                            <View className="gap-y-2">
                              <View className="rounded border border-l-4 border-zinc-200 border-l-green bg-zinc-50 px-4 py-3">
                                <Text className="italic text-zinc-800">
                                  {WEEKLY_COMMITMENT_CONFIRMATION}
                                </Text>
                              </View>
                              <TextInput
                                className={`${inputClasses} min-h-20`}
                                value={confirmation}
                                onChangeText={setConfirmation}
                                placeholder="Type the statement here"
                                placeholderTextColor="#9ca3af"
                                accessibilityLabel="Weekly commitment confirmation"
                                multiline
                                scrollEnabled={false}
                                textAlignVertical="top"
                              />
                            </View>

                            <View className="flex-row items-start">
                              <TextInput
                                className={inputClasses}
                                value={signedName}
                                onChangeText={setSignedName}
                                placeholder="Type your full name"
                                placeholderTextColor="#9ca3af"
                              />
                              <Button
                                onPress={sign}
                                color={ButtonColor.Black}
                                disabled={!canSign}
                                loading={isSubmitting}
                                title="Sign"
                                className="ml-2 min-h-12"
                              />
                            </View>
                          </View>
                        )}
                      </ContractDescriptionList>
                    </>
                  )}
                </View>
              </Card>
            </Anchor>
          )}

          <Anchor name={WalkthroughAnchor.AwayRanges}>
            <Card cardStyle={CardStyle.White}>
              <AwayRangesSection />
            </Card>
          </Anchor>

          <Card cardStyle={CardStyle.White}>
            <Text className="text-2xl mb-4" weight={FontWeight.Semibold}>
              {membershipFaq.heading}
            </Text>
            <View className="gap-y-5">
              {membershipFaq.entries.map(({ question, answer, steps }) => (
                <View key={question} className="gap-y-1">
                  <Text className="text-zinc-900" weight={FontWeight.Semibold}>
                    {question}
                  </Text>
                  <Text className="text-base">{answer}</Text>
                  {steps && (
                    <View className="gap-y-1 pl-4">
                      {steps.map((step, index) => (
                        <View key={step} className="flex-row gap-x-2">
                          <Text className="text-base">{index + 1}.</Text>
                          <Text className="flex-1 text-base">{step}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </Card>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
