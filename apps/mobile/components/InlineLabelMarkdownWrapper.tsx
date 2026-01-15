import React, { useMemo } from "react";
import Markdown, { RenderRules } from "react-native-markdown-display";
import { colors } from "../lib/style/colors";
import Text from "./system/Text";
import { useHandleLinkPress } from "./AppMarkdownWrapper";

const InlineLabelMarkdownWrapper: React.FC<{ children: string }> = ({
  children,
}) => {
  const handleLinkPress = useHandleLinkPress();

  const rules: RenderRules = useMemo(
    () => ({
      paragraph: (node, children) => <Text key={node.key}>{children}</Text>,
      body: (node, children) => <Text key={node.key}>{children}</Text>,
      link: (node, children) => (
        <Text
          key={node.key}
          style={{ color: colors.green, textDecorationLine: "underline" }}
          onPress={() => handleLinkPress(node.attributes?.href || "")}
        >
          {children}
        </Text>
      ),
      image: () => null,
      fence: () => null,
      code_block: () => null,
      heading1: (n, c) => <Text key={n.key}>{c}</Text>,
      heading2: (n, c) => <Text key={n.key}>{c}</Text>,
      heading3: (n, c) => <Text key={n.key}>{c}</Text>,
      bullet_list: (n, c) => <Text key={n.key}>{c}</Text>,
      ordered_list: (n, c) => <Text key={n.key}>{c}</Text>,
      list_item: (n, c) => <Text key={n.key}>{c}</Text>,
    }),
    [handleLinkPress]
  );

  const markdownStyles = useMemo(
    () => ({
      body: { fontSize: 15, lineHeight: 22, color: "#18181b" },
      paragraph: { marginTop: 0, marginBottom: 0 },
      strong: { fontWeight: "600" as const },
      link: { color: colors.green, textDecorationLine: "underline" as const },
    }),
    []
  );

  return (
    <Markdown style={markdownStyles} rules={rules} mergeStyle>
      {children}
    </Markdown>
  );
};

export default InlineLabelMarkdownWrapper;
