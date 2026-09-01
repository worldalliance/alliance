import { EditableContentDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import React, { memo, useMemo } from "react";
import { View } from "react-native";
import AppMarkdownWrapper from "./AppMarkdownWrapper";
import ImageLightbox from "./ImageLightbox";
import Text from "./system/Text";

interface EditableContentRendererProps {
  content: EditableContentDto;
  collapsed?: boolean;
  deleted?: boolean;
  className?: string;
  truncated?: boolean;
  small?: boolean;
}

const EditableContentRenderer: React.FC<EditableContentRendererProps> = ({
  content,
  collapsed = false,
  deleted = false,
  className,
  truncated = false,
  small = false,
}) => {
  const attachments = useMemo(
    () =>
      (content.attachments ?? []).filter((src): src is string => Boolean(src)),
    [content.attachments],
  );
  const body = content?.body ?? "";

  if (deleted) {
    return (
      <View className={className}>
        <Text className={cn("text-zinc-400", small ? "text-xs" : "text-sm")}>
          Content has been deleted
        </Text>
      </View>
    );
  }

  const renderBody = () => {
    if (!body) return null;
    if (collapsed) {
      return (
        <Text
          className={cn("text-zinc-800", small && "text-sm")}
          numberOfLines={1}
        >
          {body}
        </Text>
      );
    }

    return (
      <AppMarkdownWrapper truncated={truncated} small={small}>
        {body}
      </AppMarkdownWrapper>
    );
  };

  return (
    <View className={className}>
      {renderBody()}
      {attachments.length > 0 && (
        <View className={cn("flex-row flex-wrap gap-2", body && "mt-2")}>
          <ImageLightbox uris={attachments} />
        </View>
      )}
    </View>
  );
};

export default memo(EditableContentRenderer);
