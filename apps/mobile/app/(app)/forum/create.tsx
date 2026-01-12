import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useAuth } from "../../../lib/AuthContext";
import { router } from "expo-router";
import {
  ActionDto,
  actionsFindAll,
  forumCreatePost,
} from "../../../../../shared/client";
import Button, { ButtonColor } from "../../../components/system/Button";
import Card, { CardStyle } from "../../../components/system/Card";
import Input from "../../../components/system/Input";
import { colors } from "../../../lib/style/colors";

export default function CreatePostScreen() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedAction, setSelectedAction] = useState<ActionDto | null>(null);
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [showActionPicker, setShowActionPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [contentError, setContentError] = useState("");

  useEffect(() => {
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    fetchActions();
  }, [user]);

  const fetchActions = async () => {
    try {
      const response = await actionsFindAll();
      if (response.error) {
        throw new Error("Failed to fetch actions");
      }
      setActions(response.data || []);
    } catch (err) {
      console.error("Error fetching actions:", err);
    }
  };

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
          actionId: selectedAction?.id,
          editableContent: { body: content.trim(), attachments: [] },
        },
      });

      if (response.error || !response.data) {
        throw new Error("Failed to create post");
      }

      Alert.alert("Success", "Post created successfully!", [
        {
          text: "OK",
          onPress: () => router.push(`/forum/post/${response.data.id}`),
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
        ]
      );
    } else {
      router.back();
    }
  };

  const ActionPicker = () => (
    <Card cardStyle={CardStyle.White} style={styles.actionPicker}>
      <View style={styles.actionPickerHeader}>
        <Text style={styles.actionPickerTitle}>Select Action (Optional)</Text>
        <TouchableOpacity onPress={() => setShowActionPicker(false)}>
          <Text style={styles.actionPickerTitle}>Close</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.actionOption}
        onPress={() => {
          setSelectedAction(null);
          setShowActionPicker(false);
        }}
      >
        <Text style={styles.actionOptionText}>No Action</Text>
      </TouchableOpacity>

      {actions.map((action) => (
        <TouchableOpacity
          key={action.id}
          style={styles.actionOption}
          onPress={() => {
            setSelectedAction(action);
            setShowActionPicker(false);
          }}
        >
          <Text style={styles.actionOptionText}>{action.name}</Text>
          <Text style={styles.actionOptionCategory}>{action.category}</Text>
        </TouchableOpacity>
      ))}
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button
          title="Cancel"
          onPress={handleCancel}
          color={ButtonColor.Light}
          style={styles.headerButton}
        />
        <Text style={styles.headerTitle}>New Post</Text>
        <Button
          title={submitting ? "Posting..." : "Post"}
          onPress={handleSubmit}
          color={ButtonColor.Green}
          disabled={submitting}
          style={styles.headerButton}
        />
      </View>

      <ScrollView style={styles.scrollContainer}>
        <Card cardStyle={CardStyle.White} style={styles.formCard}>
          <Input
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Enter post title"
            error={titleError}
            required
            style={styles.titleInput}
          />

          <Input
            label="Content"
            value={content}
            onChangeText={setContent}
            placeholder="Write your post content here..."
            multiline
            error={contentError}
            required
            style={styles.contentInput}
          />

          <View style={styles.actionSection}>
            <Text style={styles.actionLabel}>Associated Action</Text>
            <TouchableOpacity
              style={styles.actionSelector}
              onPress={() => setShowActionPicker(true)}
            >
              <Text style={styles.actionSelectorText}>
                {selectedAction
                  ? selectedAction.name
                  : "Select Action (Optional)"}
              </Text>
            </TouchableOpacity>
            {selectedAction && (
              <Text style={styles.selectedActionCategory}>
                Category: {selectedAction.category}
              </Text>
            )}
          </View>
        </Card>

        <Card cardStyle={CardStyle.Grey} style={styles.helpCard}>
          <Text style={styles.helpTitle}>Posting Guidelines</Text>
          <Text style={styles.helpText}>
            • Be respectful and constructive in your discussions
          </Text>
          <Text style={styles.helpText}>
            • Use clear, descriptive titles for your posts
          </Text>
          <Text style={styles.helpText}>
            • Link to relevant actions when applicable
          </Text>
          <Text style={styles.helpText}>
            • Search existing posts before creating duplicates
          </Text>
        </Card>
      </ScrollView>

      {showActionPicker && (
        <View style={styles.overlay}>
          <ActionPicker />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.page,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.primary,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  formCard: {
    marginTop: 16,
    marginBottom: 16,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: "500",
  },
  contentInput: {
    minHeight: 120,
  },
  actionSection: {
    marginTop: 16,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text.primary,
    marginBottom: 8,
  },
  actionSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  actionSelectorText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  selectedActionCategory: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  helpCard: {
    marginBottom: 24,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  actionPicker: {
    width: "100%",
    maxHeight: "80%",
  },
  actionPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  actionPickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.primary,
  },
  actionOption: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionOptionText: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: "500",
  },
  actionOptionCategory: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
