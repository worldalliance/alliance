import {
  authMe,
  contractGetById,
  contractGetCurrent,
  contractSignContract,
  contractSuspendContract,
} from "@alliance/shared/client";
import {
  CONTRACT_NOTES,
  ContractEventState,
  getLastContractEvent,
  getSignedMessage,
  getSuspensionMessage,
} from "@alliance/shared/lib/contract";
import { suspendContractConfirmation } from "@alliance/shared/lib/copy";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, TextInput, View } from "react-native";
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
      <Text className="text-green mt-2" weight={FontWeight.Medium}>
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
              <Card cardStyle={CardStyle.White}>
                <View className="gap-y-2">
                  <AppMarkdownWrapper>
                    {signedContract.markdown}
                  </AppMarkdownWrapper>
                </View>
              </Card>
              {signedContractMessage}
            </View>
          )}

          {latestContract && (
            <View className="gap-y-2">
              {signedContractId && signedContractId !== latestContract.id && (
                <Text className="p-2" weight={FontWeight.Semibold}>
                  An updated contract is available.
                </Text>
              )}
              <Card cardStyle={CardStyle.White}>
                <View className="gap-y-2">
                  <AppMarkdownWrapper>
                    {latestContract.markdown}
                  </AppMarkdownWrapper>
                </View>
              </Card>
              {lastContractEvent?.type === "signed" &&
              lastContractEvent.contractId === latestContract.id ? (
                signedContractMessage
              ) : (
                <Card
                  cardStyle={CardStyle.LightGreyBorder}
                  className="gap-y-4 mt-2"
                >
                  <View className="gap-y-1">
                    <Text
                      className="text-xl text-zinc-900"
                      weight={FontWeight.Semibold}
                    >
                      Confirm your commitment
                    </Text>
                    <Text className="text-sm text-zinc-700">
                      Before signing, please type the statement below to confirm
                      that you understand the weekly commitment.
                    </Text>
                  </View>

                  <View className="gap-y-2">
                    <View className="rounded border border-l-4 border-zinc-200 border-l-green bg-white px-4 py-3">
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
                        isSubmitting || !editName || !weeklyCommitmentConfirmed
                      }
                      loading={isSubmitting}
                      title="Sign"
                      className="ml-2 min-h-12"
                    />
                  </View>
                </Card>
              )}
            </View>
          )}

          {/* Suspend (when signed) */}
          {lastContractEvent?.type === "signed" && (
            <Button
              onPress={handleContractSuspend}
              color={ButtonColor.Red}
              disabled={isSubmitting}
              loading={isSubmitting}
              title="Suspend contract"
            />
          )}

          {/* Notes */}
          <View>
            <Text className="text-zinc-900">Notes:</Text>
            <View>
              {CONTRACT_NOTES.map((note: string, index: number) => (
                <View key={index} className="flex-row pl-2">
                  <Text className="">• </Text>
                  <Text className="flex-1">{note}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
