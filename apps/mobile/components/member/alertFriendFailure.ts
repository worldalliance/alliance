import { friendMutationErrorMessage } from "@alliance/shared/lib/user";
import { Alert } from "react-native";

export const alertFriendFailure = (title: string, error: unknown) =>
  Alert.alert(title, friendMutationErrorMessage(error));
