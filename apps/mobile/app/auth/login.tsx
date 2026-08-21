import { authForgotPassword } from "@alliance/shared/client";
import { forgotPassword as forgotPasswordCopy } from "@alliance/shared/lib/copy";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import Button from "../../components/system/Button";
import Card, { CardStyle } from "../../components/system/Card";
import Input from "../../components/system/Input";
import PasswordVisibilityToggle from "../../components/system/PasswordVisibilityToggle";
import Text, { FontWeight } from "../../components/system/Text";
import { useAuth } from "../../lib/AuthContext";

const LoginScreen = () => {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleForgotPassword = async () => {
    if (isSendingReset) return;
    if (!email) {
      Alert.alert(
        forgotPasswordCopy.emailRequired.title,
        forgotPasswordCopy.emailRequired.message,
      );
      return;
    }

    setIsSendingReset(true);
    try {
      const resp = await authForgotPassword({ body: { email } });
      if (resp.error) {
        Alert.alert("Error", forgotPasswordCopy.sendError);
        return;
      }
      Alert.alert(
        forgotPasswordCopy.sendSuccess.title,
        forgotPasswordCopy.sendSuccess.message,
      );
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (error) {
      const errorMessage = (error as any)?.message
        ? `${(error as any).message}`
        : "Login failed. Please try again.";
      Alert.alert("Login Failed", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex flex-col bg-zinc-100 py-16 flex-1 px-2">
      <View className="flex-1 pt-20 justify-start">
        <Text className="text-3xl mb-6 px-3" weight={FontWeight.Bold}>
          The Alliance
        </Text>

        <Card cardStyle={CardStyle.White}>
          <View className="flex flex-col gap-y-6">
            <View>
              <Text className="mb-2">Email</Text>
              <Input
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                textContentType="username"
                autoComplete="username"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            </View>
            <View>
              <Text className="mb-2">Password</Text>
              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="password"
                autoComplete="current-password"
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
                rightElement={
                  <PasswordVisibilityToggle
                    visible={showPassword}
                    onPress={() => setShowPassword((current) => !current)}
                  />
                }
              />
            </View>
            <Button
              onPress={handleLogin}
              disabled={isSubmitting || !email || !password}
              loading={isSubmitting}
              className="rounded-md w-full self-center py-4!"
            >
              <Text className="text-white text-base" weight={FontWeight.Medium}>
                Log in
              </Text>
            </Button>
          </View>
        </Card>
        <Pressable
          onPress={handleForgotPassword}
          disabled={isSendingReset}
          className={`mt-4 self-center ${isSendingReset ? "opacity-50" : ""}`}
        >
          <Text className="text-green">{forgotPasswordCopy.prompt}</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default LoginScreen;
