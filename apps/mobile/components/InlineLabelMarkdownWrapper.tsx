import React, { useMemo } from "react";
import Markdown, { RenderRules } from "react-native-markdown-display";
import { useHandleLinkPress } from "./AppMarkdownWrapper";
import {
  MARKDOWN_PALETTES,
  MarkdownTone,
  useMarkdownTextStyles,
} from "./markdownStyles";
import Text from "./system/Text";

const PALETTE = MARKDOWN_PALETTES[MarkdownTone.Default];

const InlineLabelMarkdownWrapper: React.FC<{ children: string }> = ({
  children,
}) => {
  const handleLinkPress = useHandleLinkPress();
  const textStyles = useMarkdownTextStyles();

  const rules: RenderRules = useMemo(
    () => ({
      paragraph: (node, children) => <Text key={node.key}>{children}</Text>,
      body: (node, children) => <Text key={node.key}>{children}</Text>,
      link: (node, children, _parent, styles) => (
        <Text
          key={node.key}
          style={styles.link}
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
      heading4: (n, c) => <Text key={n.key}>{c}</Text>,
      heading5: (n, c) => <Text key={n.key}>{c}</Text>,
      heading6: (n, c) => <Text key={n.key}>{c}</Text>,
      bullet_list: (n, c) => <Text key={n.key}>{c}</Text>,
      ordered_list: (n, c) => <Text key={n.key}>{c}</Text>,
      list_item: (n, c) => <Text key={n.key}>{c}</Text>,
    }),
    [handleLinkPress],
  );

  const markdownStyles = useMemo(
    () => ({
      body: { ...textStyles.body, color: PALETTE.text },
      paragraph: { marginTop: 0, marginBottom: 0 },
      strong: textStyles.strong,
      link: { color: PALETTE.link, textDecorationLine: "underline" as const },
    }),
    [textStyles.body, textStyles.strong],
  );

  return (
    <Markdown style={markdownStyles} rules={rules} mergeStyle>
      {children}
    </Markdown>
  );
};

export default InlineLabelMarkdownWrapper;
