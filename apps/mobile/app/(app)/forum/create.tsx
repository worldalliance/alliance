import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { forumCreatePost } from "../../../../../shared/client";
import KeyboardAwareScrollView from "../../../components/KeyboardAwareScrollView";
import Button, { ButtonColor } from "../../../components/system/Button";
import Card, { CardStyle } from "../../../components/system/Card";
import Input from "../../../components/system/Input";
import Text, { FontWeight } from "../../../components/system/Text";

export default function CreatePostScreen() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [contentError, setContentError] = useState("");

  const validateForm = () => {
    let isValid = true;

    if (!title.trim()) {
      setTitleError("Title is required");
      isValid = false;
    } else {
      setTitleError("");
    }

    if (!content.trim()) {
      setContentError("Content is required");
      isValid = false;
    } else {
      setContentError("");
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const response = await forumCreatePost({
        body: {
          title: title.trim(),
          editableContent: { body: content.trim(), attachments: [] },
        },
      });

      if (response.error || !response.data) {
        throw new Error("Failed to create post");
      }

      Alert.alert("Success", "Post created", [
        {
          text: "OK",
          onPress: () => router.replace(`/forum/post/${response.data.id}`),
        },
      ]);
    } catch (err) {
      Alert.alert("Error", "Failed to create post. Please try again.");
      console.error("Error creating post:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (title.trim() || content.trim()) {
      Alert.alert(
        "Discard Changes",
        "Are you sure you want to discard your post?",
        [
          { text: "Keep Writing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => router.back(),
          },
        ],
      );
    } else {
      router.back();
    }
  };

  return (
    <View className="flex-1 bg-white pt-14">
      <View className="flex-row justify-between items-center px-4">
        <Button
          title="Cancel"
          onPress={handleCancel}
          color={ButtonColor.Light}
          disabled={submitting}
        />
        <Text className="text-2xl" weight={FontWeight.Bold}>
          New Post
        </Text>
        <Button
          title={submitting ? "Posting..." : "Post"}
          onPress={handleSubmit}
          color={ButtonColor.Green}
          disabled={submitting}
        />
      </View>

      <KeyboardAwareScrollView className="px-4">
        <Card cardStyle={CardStyle.White} className="gap-4">
          <Input
            label="Title"
            value={title}
            onChangeText={setTitle}
            editable={!submitting}
            containerClassName={submitting ? "opacity-50" : undefined}
            placeholder="Enter post title"
            error={titleError}
            required
          />

          <Input
            label="Content"
            value={content}
            onChangeText={setContent}
            editable={!submitting}
            containerClassName={submitting ? "opacity-50" : undefined}
            placeholder="Write your post content here..."
            multiline
            error={contentError}
            required
          />
        </Card>
      </KeyboardAwareScrollView>
    </View>
  );
}
