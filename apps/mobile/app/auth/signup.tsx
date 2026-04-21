import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { authRegister } from "@alliance/shared/client";
import {
  clearGuestToken,
  getStoredGuestToken,
} from "../../lib/guestSession";
import Button from "../../components/system/Button";
import Input from "../../components/system/Input";
import PasswordVisibilityToggle from "../../components/system/PasswordVisibilityToggle";
import Text from "../../components/system/Text";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

const SignupScreen = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
  });

  const validateForm = () => {
    let isValid = true;
    const newErrors = { name: "", email: "", password: "" };

    if (name.trim().length === 0) {
      newErrors.name = "Name is required";
      isValid = false;
    }

    if (email.trim().length === 0) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Email is invalid";
      isValid = false;
    }

    if (password.trim().length === 0) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSignup = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const guestToken = (await getStoredGuestToken()) ?? undefined;
      await authRegister({
        body: {
          name,
          email,
          password,
          mode: "header",
          guestToken,
        },
      });
      if (guestToken) {
        await clearGuestToken();
      }

      Alert.alert(
        "Registration Successful",
        "Your account has been created. Please log in.",
        [
          {
            text: "Log In",
            onPress: () => router.replace("/auth/login"),
          },
        ]
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Registration failed. Please try again.";

      Alert.alert("Registration Failed", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <View className="flex flex-col gap-y-4">
          <Text className="text-sm text-zinc-500">Create an Account</Text>

          <View className="flex flex-col gap-y-2">
            <Text className="text-sm text-zinc-500">Full Name</Text>
            <Input
              placeholder="John Doe"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors({ ...errors, name: "" });
              }}
              autoCapitalize="words"
            />
            {errors.name ? (
              <Text className="text-sm text-zinc-500">{errors.name}</Text>
            ) : null}
          </View>

          <View className="flex flex-col gap-y-2">
            <Text className="text-sm text-zinc-500">Email</Text>
            <Input
              placeholder="your@email.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: "" });
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            {errors.email ? (
              <Text className="text-sm text-zinc-500">{errors.email}</Text>
            ) : null}
          </View>

          <View className="flex flex-col gap-y-2">
            <Text className="text-sm text-zinc-500">Password</Text>
            <Input
              placeholder="Minimum 8 characters"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: "" });
              }}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              rightElement={
                <PasswordVisibilityToggle
                  visible={showPassword}
                  onPress={() => setShowPassword((current) => !current)}
                />
              }
            />
            {errors.password ? (
              <Text className="text-sm text-zinc-500">{errors.password}</Text>
            ) : null}
          </View>

          <Button onPress={handleSignup} disabled={isSubmitting} loading={isSubmitting}>
            <Text className="text-white text-base">Create Account</Text>
          </Button>

          <View className="flex flex-row gap-x-2">
            <Text className="text-sm text-zinc-500">Already have an account?</Text>
            <Link href="/auth/login" asChild>
              <TouchableOpacity>
                <Text className="text-sm text-zinc-500">Log In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SignupScreen;
