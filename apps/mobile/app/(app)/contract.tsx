import React, { useCallback, useEffect, useState } from "react";
import { Alert, TextInput, View } from "react-native";
import {
  userSignContract,
  userSuspendContract,
  authMe,
} from "@alliance/shared/client";
import {
  ContractEventState,
  getLastContractEvent,
  getSuspensionMessage,
  getSignedMessage,
  CONTRACT_TERMS,
  CONTRACT_NOTES,
} from "@alliance/shared/lib/contract";
import { useAuth } from "../../lib/AuthContext";
import Text from "../../components/system/Text";
import Button, { ButtonColor } from "../../components/system/Button";
import Card, { CardStyle } from "../../components/system/Card";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { suspendContractConfirmation } from "@alliance/shared/lib/copy";

export default function ContractScreen() {
  const { user } = useAuth();

  const [editName, setEditName] = useState("");
  const [lastContractEvent, setLastContractEvent] =
    useState<ContractEventState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await userSignContract({
        body: { signedName: editName },
      });
      if (res.data) {
        setLastContractEvent({
          type: "signed",
          date: res.data,
          automatic: false,
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
  }, [editName, isSubmitting, refreshContractState]);

  const handleContractSuspend = useCallback(() => {
    Alert.alert("Suspend Contract", suspendContractConfirmation, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Suspend",
        style: "destructive",
        onPress: async () => {
          setIsSubmitting(true);
          try {
            const res = await userSuspendContract();
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
    <KeyboardAwareScrollView className="flex-1 bg-white" bottomOffset={50}>
      <View className="p-4 pt-16 gap-y-2">
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

        {/* Contract Terms */}
        <Card cardStyle={CardStyle.Outline} className="border-zinc-200 border">
          <View className="gap-y-2">
            {CONTRACT_TERMS.map((term: (typeof CONTRACT_TERMS)[number]) => (
              <View key={term.id}>
                <View className="flex-row">
                  <Text className="w-6">{term.id}.</Text>
                  <Text className="flex-1">{term.text}</Text>
                </View>
                {"subItems" in term && term.subItems && (
                  <View className="ml-6 mt-1 gap-y-1">
                    {term.subItems.map(
                      (subItem: { id: string; text: string }) => (
                        <View key={subItem.id} className="flex-row">
                          <Text className="w-6">{subItem.id}.</Text>
                          <Text className="flex-1">{subItem.text}</Text>
                        </View>
                      )
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        </Card>

        {/* Sign Section */}
        {lastContractEvent?.type !== "signed" && (
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

        {/* Signed Section */}
        {lastContractEvent?.type === "signed" && (
          <View className="gap-y-4">
            <Text className="text-green font-medium">
              {getSignedMessage(lastContractEvent.date)}
            </Text>
            <Button
              onPress={handleContractSuspend}
              color={ButtonColor.Red}
              disabled={isSubmitting}
              loading={isSubmitting}
              title="Suspend contract"
            />
          </View>
        )}
      </View>
    </KeyboardAwareScrollView>
  );
}
