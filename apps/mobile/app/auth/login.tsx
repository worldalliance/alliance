import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Stack, Link, useRouter } from "expo-router";
import { useAuth } from "../../lib/AuthContext";
import { authStyles } from "../../lib/style/authStyles";
import { colors } from "../../lib/style/colors";
import Button, { ButtonColor } from "../../components/system/Button";
import Input from "../../components/system/Input";
import Text, { TextStyle } from "../../components/system/Text";

const LoginScreen = () => {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Login failed. Please try again.";
      Alert.alert("Login Failed", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={authStyles.container}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <ScrollView contentContainerStyle={authStyles.scrollContent}>
        <View className="px-3 flex flex-col gap-y-4">
          <View>
            <Text style={authStyles.label}>Email</Text>
            <Input
              placeholder="your@email.com"
              placeholderTextColor={colors.text.tertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          <View>
            <Text style={authStyles.label}>Password</Text>
            <Input
              placeholder="Your password"
              placeholderTextColor={colors.text.tertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Button
            onPress={handleLogin}
            disabled={isSubmitting || isLoading}
            color={ButtonColor.Black}
          >
            {isSubmitting || isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text type={TextStyle.Label}>Log In</Text>
            )}
          </Button>

          <View className="flex-row justify-center gap-x-2">
            <Text style={authStyles.linkText}>Don&apos;t have an account?</Text>
            <Link href="/auth/signup" asChild>
              <TouchableOpacity>
                <Text style={authStyles.link}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
