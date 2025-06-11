import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Stack, Link, useRouter } from "expo-router";
import { authRegister } from "@alliance/shared/client";
import { authStyles } from "../../lib/style/authStyles";

const SignupScreen = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await authRegister({
        body: {
          name,
          email,
          password,
          mode: "header",
        },
      });

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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={authStyles.container}
    >
      <Stack.Screen
        options={{
          title: "Sign Up",
          headerShown: true,
        }}
      />
      <ScrollView contentContainerStyle={authStyles.scrollContent}>
        <View style={authStyles.formContainer}>
          <Text style={authStyles.title}>Create an Account</Text>

          <View style={authStyles.inputContainer}>
            <Text style={authStyles.label}>Full Name</Text>
            <TextInput
              style={[
                authStyles.input,
                errors.name ? authStyles.inputError : null,
              ]}
              placeholder="John Doe"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors({ ...errors, name: "" });
              }}
              autoCapitalize="words"
            />
            {errors.name ? (
              <Text style={authStyles.errorText}>{errors.name}</Text>
            ) : null}
          </View>

          <View style={authStyles.inputContainer}>
            <Text style={authStyles.label}>Email</Text>
            <TextInput
              style={[
                authStyles.input,
                errors.email ? authStyles.inputError : null,
              ]}
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
              <Text style={authStyles.errorText}>{errors.email}</Text>
            ) : null}
          </View>

          <View style={authStyles.inputContainer}>
            <Text style={authStyles.label}>Password</Text>
            <TextInput
              style={[
                authStyles.input,
                errors.password ? authStyles.inputError : null,
              ]}
              placeholder="Minimum 8 characters"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: "" });
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.password ? (
              <Text style={authStyles.errorText}>{errors.password}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={authStyles.primaryButton}
            onPress={handleSignup}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={authStyles.primaryButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={authStyles.linkContainer}>
            <Text style={authStyles.linkText}>Already have an account?</Text>
            <Link href="/auth/login" asChild>
              <TouchableOpacity>
                <Text style={authStyles.link}>Log In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SignupScreen;
