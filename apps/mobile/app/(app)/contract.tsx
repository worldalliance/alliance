import {
  authMe,
  contractGetById,
  contractGetCurrent,
  contractSignContract,
  contractSuspendContract,
} from "@alliance/shared/client";
import {
  ContractEventState,
  getLastContractEvent,
  getSignedMessage,
  getSuspensionMessage,
} from "@alliance/shared/lib/contract";
import { suspendContractConfirmation } from "@alliance/shared/lib/copy";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Alert, TextInput, TouchableOpacity, View } from "react-native";
import AppMarkdownWrapper from "../../components/AppMarkdownWrapper";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import Button, { ButtonColor } from "../../components/system/Button";
import Card, { CardStyle } from "../../components/system/Card";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../components/system/Text";
import { useAuth } from "../../lib/AuthContext";
import { colors } from "../../lib/style/colors";

const WEEKLY_COMMITMENT_CONFIRMATION =
  "I commit to complete each task to the best of my ability.";

const COMMITMENT_CONFIRMATION_LENGTH_TOLERANCE = 10;

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
    <View className="gap-y-5 rounded border border-zinc-200 bg-white p-5">
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
        title="Suspend contract"
      />
    </View>
  );
}

const isConfirmationLengthCloseEnough = (confirmation: string) =>
  Math.abs(
    confirmation.trim().length - WEEKLY_COMMITMENT_CONFIRMATION.length,
  ) <= COMMITMENT_CONFIRMATION_LENGTH_TOLERANCE;

export default function ContractScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [editName, setEditName] = useState("");
  const [weeklyCommitmentConfirmation, setWeeklyCommitmentConfirmation] =
    useState("");
  const [lastContractEvent, setLastContractEvent] =
    useState<ContractEventState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const weeklyCommitmentConfirmed = isConfirmationLengthCloseEnough(
    weeklyCommitmentConfirmation,
  );

  const { data: latestContract } = useQuery({
    queryKey: ["contractGetCurrent"],
    queryFn: () => contractGetCurrent().then((res) => res.data ?? null),
  });

  const signedContractId = lastContractEvent?.contractId ?? null;

  const { data: signedContract } = useQuery({
    queryKey: ["contractGetById", signedContractId],
    queryFn: () =>
      contractGetById({
        path: { id: signedContractId! },
      }).then((res) => res.data ?? null),
    enabled: signedContractId !== null,
  });

  useEffect(() => {
    if (user) {
      setLastContractEvent(getLastContractEvent(user.contractEvents));
    }
  }, [user]);

  const refreshContractState = useCallback(async () => {
    try {
      const response = await authMe();
      if (response.data?.user?.contractEvents) {
        setLastContractEvent(
          getLastContractEvent(response.data.user.contractEvents),
        );
      }
    } catch (error) {
      console.error("Error refreshing contract state:", error);
    }
  }, []);

  const handleContractSign = useCallback(async () => {
    if (isSubmitting || !latestContract || !weeklyCommitmentConfirmed) return;
    setIsSubmitting(true);

    try {
      const res = await contractSignContract({
        path: { id: latestContract.id },
        body: { signedName: editName },
      });
      if (res.data) {
        setLastContractEvent({
          type: "signed",
          date: res.data.date,
          automatic: false,
          contractId: latestContract.id,
        });
        setWeeklyCommitmentConfirmation("");
        void queryClient.invalidateQueries({
          queryKey: queryKeys.myVisibilityContext(),
        });
        await refreshContractState();
      }
    } catch (error) {
      console.error("Error signing contract:", error);
      Alert.alert(
        "Error",
        "There was an error signing the contract. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    latestContract,
    weeklyCommitmentConfirmed,
    editName,
    queryClient,
    refreshContractState,
  ]);

  const handleContractSuspend = useCallback(() => {
    Alert.alert("Suspend Contract", suspendContractConfirmation, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Suspend",
        style: "destructive",
        onPress: async () => {
          setIsSubmitting(true);
          try {
            const res = await contractSuspendContract();
            if (res.data) {
              setLastContractEvent({
                type: "suspended",
                date: res.data.date,
                automatic: false,
                contractId: null,
              });
              await refreshContractState();
            }
          } catch (error) {
            console.error("Error suspending contract:", error);
            Alert.alert(
              "Error",
              "There was an error suspending the contract. Please try again.",
            );
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
  }, [refreshContractState]);

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
      <SimplePageTitle title="Membership contract" />
      <KeyboardAwareScrollView testID="vr-contract-ready">
        <View className="p-4 gap-y-4 pt-0">
          {/* Suspended Warning */}
          {lastContractEvent?.type === "suspended" && (
            <Card cardStyle={CardStyle.Red}>
              <Text className="">
                {getSuspensionMessage(
                  lastContractEvent.date,
                  lastContractEvent.automatic,
                )}
              </Text>
            </Card>
          )}

          {signedContract && signedContractId !== latestContract?.id && (
            <View className="gap-y-2">
              <ContractDescriptionList
                items={signedContract.description}
                markdown={signedContract.markdown}
              >
                {lastContractEvent?.type === "signed" && (
                  <SignedContractActions
                    message={signedContractMessage}
                    onSuspend={handleContractSuspend}
                    isSubmitting={isSubmitting}
                  />
                )}
              </ContractDescriptionList>
            </View>
          )}

          {latestContract && (
            <View className="gap-y-2">
              {signedContractId && signedContractId !== latestContract.id && (
                <Text className="p-2" weight={FontWeight.Semibold}>
                  An updated contract is available.
                </Text>
              )}
              <ContractDescriptionList
                items={latestContract.description}
                markdown={latestContract.markdown}
              >
                {lastContractEvent?.type === "signed" &&
                lastContractEvent.contractId === latestContract.id ? (
                  <SignedContractActions
                    message={signedContractMessage}
                    onSuspend={handleContractSuspend}
                    isSubmitting={isSubmitting}
                  />
                ) : (
                  <View className="gap-y-4 border-t border-zinc-200 pt-5">
                    <View className="gap-y-1">
                      <Text
                        className="text-xl text-zinc-900"
                        weight={FontWeight.Semibold}
                      >
                        Confirm your commitment
                      </Text>
                      <Text className="text-sm text-zinc-700">
                        Before signing, please type the statement below to
                        confirm that you understand the weekly commitment.
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
                        value={weeklyCommitmentConfirmation}
                        onChangeText={setWeeklyCommitmentConfirmation}
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
                        value={editName}
                        onChangeText={setEditName}
                        placeholder="Type your full name"
                        placeholderTextColor="#9ca3af"
                      />
                      <Button
                        onPress={handleContractSign}
                        color={ButtonColor.Black}
                        disabled={
                          isSubmitting ||
                          !editName ||
                          !weeklyCommitmentConfirmed
                        }
                        loading={isSubmitting}
                        title="Sign"
                        className="ml-2 min-h-12"
                      />
                    </View>
                  </View>
                )}
              </ContractDescriptionList>
            </View>
          )}

          <View className="my-4 gap-y-5">
            <Text
              className="text-xl text-zinc-900"
              weight={FontWeight.Semibold}
            >
              Questions about membership
            </Text>
            <View className="gap-y-1">
              <Text className="text-zinc-900" weight={FontWeight.Semibold}>
                Why is there a contract?
              </Text>
              <Text className="text-base">
                The contract ensures that we can count on your participation,
                which allows us to plan actions precisely. By signing, you are
                also making a commitment to your peers to work together
                consistently.
              </Text>
            </View>
            <View className="gap-y-1">
              <Text className="text-zinc-900" weight={FontWeight.Semibold}>
                What happens if I don&apos;t follow the contract?
              </Text>
              <Text className="text-base">
                If you miss all assigned non-optional actions for 3 weeks in a
                row, your contract will be suspended automatically. You can
                re-sign the contract to re-join the Alliance.
              </Text>
            </View>
            <View className="gap-y-1">
              <Text className="text-zinc-900" weight={FontWeight.Semibold}>
                Are there valid reasons to miss an action?
              </Text>
              <Text className="text-base">
                Yes. For our planning purposes, we ask that you inform us if you
                will be unable to complete an action with one of the following
                methods:
              </Text>
              <View className="gap-y-1 pl-4">
                <View className="flex-row gap-x-2">
                  <Text className="text-base">1.</Text>
                  <Text className="flex-1 text-base">
                    You can withdraw from an action by tapping the three dots at
                    the bottom right of an action, next to the Complete button.
                    You can withdraw if the action is taking you longer than 15
                    minutes to complete, or if you have a moral objection to the
                    action.
                  </Text>
                </View>
                <View className="flex-row gap-x-2">
                  <Text className="text-base">2.</Text>
                  <Text className="flex-1 text-base">
                    You can mark yourself as away in Settings if you won&apos;t
                    be able to complete actions for a prolonged period, such as
                    during a vacation.
                  </Text>
                </View>
              </View>
            </View>
            <View className="gap-y-1">
              <View className="flex-row items-center gap-x-2">
                <Text className="text-zinc-900" weight={FontWeight.Semibold}>
                  How do I end my membership?
                </Text>
              </View>
              <Text className="text-base">
                You can end your membership at any time by suspending your
                contract on this page.
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
