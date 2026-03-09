import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, TextInput, View } from "react-native";
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
  getSuspensionMessage,
  getSignedMessage,
  PLACEHOLDER_CONTRACT_MARKDOWN,
  CONTRACT_NOTES,
} from "@alliance/shared/lib/contract";
import { useAuth } from "../../lib/AuthContext";
import Text from "../../components/system/Text";
import Button, { ButtonColor } from "../../components/system/Button";
import Card, { CardStyle } from "../../components/system/Card";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { suspendContractConfirmation } from "@alliance/shared/lib/copy";
import AppMarkdownWrapper from "../../components/AppMarkdownWrapper";
import { useQuery } from "@tanstack/react-query";

export default function ContractScreen() {
  const { user } = useAuth();

  const [editName, setEditName] = useState("");
  const [lastContractEvent, setLastContractEvent] =
    useState<ContractEventState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: latestContract } = useQuery({
    queryKey: ["contractGetCurrent"],
    queryFn: () => contractGetCurrent().then((res) => res.data ?? null),
    initialData: {
      id: 1,
      markdown: PLACEHOLDER_CONTRACT_MARKDOWN,
    },
  });

  const signedContractId = lastContractEvent?.contractId ?? null;

  const { data: signedContract } = useQuery({
    queryKey: ["contractGetById", signedContractId],
    queryFn: () =>
      contractGetById({
        path: { id: signedContractId! },
      }).then((res) => res.data ?? null),
    enabled: signedContractId !== null && signedContractId !== latestContract?.id,
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
          getLastContractEvent(response.data.user.contractEvents)
        );
      }
    } catch (error) {
      console.error("Error refreshing contract state:", error);
    }
  }, []);

  const handleContractSign = useCallback(async () => {
    if (isSubmitting || !latestContract) return;
    setIsSubmitting(true);

    try {
      const res = await contractSignContract({
        path: { id: latestContract.id },
        body: { signedName: editName },
      });
      if (res.data) {
        setLastContractEvent({
          type: "signed",
          date: res.data,
          automatic: false,
          contractId: latestContract.id,
        });
        await refreshContractState();
      }
    } catch (error) {
      console.error("Error signing contract:", error);
      Alert.alert(
        "Error",
        "There was an error signing the contract. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, refreshContractState, editName, latestContract]);

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
                date: res.data,
                automatic: false,
              });
              await refreshContractState();
            }
          } catch (error) {
            console.error("Error suspending contract:", error);
            Alert.alert(
              "Error",
              "There was an error suspending the contract. Please try again."
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
      <Text className="text-green font-medium mt-2">
        {getSignedMessage(lastContractEvent.date)}
      </Text>
    );
  }, [lastContractEvent]);

  if (!user) {
    return (
      <View className="flex-1 bg-white p-4">
        <Text className="text-center text-zinc-500">Not found</Text>
      </View>
    );
  }

  const inputClasses =
    "border border-zinc-300 rounded bg-white px-3 py-3 text-base flex-1";

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-white"
      bottomOffset={50}
      testID="vr-contract-ready"
    >
      <View className="p-4 pt-16 gap-y-8">
        {/* Header */}
        <View className="flex-row items-center mb-1">
          <Text className="text-2xl font-semibold font-serif">
            Membership contract
          </Text>
        </View>

        {/* Notes */}
        <Text className="text-zinc-900">Notes:</Text>
        <View className="mb-4">
          {CONTRACT_NOTES.map((note: string, index: number) => (
            <View key={index} className="flex-row pl-2">
              <Text className="">• </Text>
              <Text className="flex-1">{note}</Text>
            </View>
          ))}
        </View>

        {/* Suspended Warning */}
        {lastContractEvent?.type === "suspended" && (
          <Card cardStyle={CardStyle.Red}>
            <Text className="">
              {getSuspensionMessage(
                lastContractEvent.date,
                lastContractEvent.automatic
              )}
            </Text>
          </Card>
        )}

        {/* Signed contract (when user signed an older version) */}
        {signedContract && signedContractId !== latestContract?.id && (
          <View className="gap-y-2">
            <Card
              cardStyle={CardStyle.Outline}
              className="border-zinc-200 border"
            >
              <View className="gap-y-2">
                <AppMarkdownWrapper>
                  {signedContract.markdown}
                </AppMarkdownWrapper>
              </View>
            </Card>
            {signedContractMessage}
          </View>
        )}

        {/* Latest contract */}
        {latestContract && (
          <View className="gap-y-2">
            {signedContractId && signedContractId !== latestContract.id && (
              <Text className="font-semibold p-2">
                An updated contract is available.
              </Text>
            )}
            <Card
              cardStyle={CardStyle.Outline}
              className="border-zinc-200 border"
            >
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
              <View className="flex-row mt-2">
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
                  disabled={isSubmitting || !editName}
                  loading={isSubmitting}
                  title="Sign"
                  className="ml-2"
                />
              </View>
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
      </View>
    </KeyboardAwareScrollView>
  );
}
