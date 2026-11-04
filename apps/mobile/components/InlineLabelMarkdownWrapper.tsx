import { linkHints } from "@alliance/shared/lib/copy";
import { ExternalLink } from "lucide-react-native";
import React, { useMemo } from "react";
import Markdown, { RenderRules } from "react-native-markdown-display";
import { leavesApp } from "../lib/internalLinks";
import { useHandleLinkPress } from "../lib/linkPress";
import {
  MARKDOWN_PALETTES,
  MarkdownTone,
  useMarkdownTextStyles,
} from "./markdownStyles";
import Text from "./system/Text";

const PALETTE = MARKDOWN_PALETTES[MarkdownTone.Default];

const InlineLabelMarkdownWrapper: React.FC<{
  children: string;
  /** Mark links that leave the app, as form content does elsewhere. */
  markLinksLeavingApp?: boolean;
  small?: boolean;
}> = ({ children, markLinksLeavingApp = false, small = false }) => {
  const handleLinkPress = useHandleLinkPress();
  const textStyles = useMarkdownTextStyles();

  const rules: RenderRules = useMemo(
    () => ({
      paragraph: (node, children) => <Text key={node.key}>{children}</Text>,
      body: (node, children) => <Text key={node.key}>{children}</Text>,
      link: (node, children, _parent, styles) => {
        const href = node.attributes?.href || "";
        const marked = markLinksLeavingApp && leavesApp(href);
        return (
          <Text
            key={node.key}
            style={styles.link}
            accessibilityRole={marked ? "link" : undefined}
            accessibilityHint={marked ? linkHints.opensInBrowser : undefined}
            onPress={() => handleLinkPress(href)}
          >
            {children}
            {marked ? (
              <>
                {"\u00a0"}
                <ExternalLink size={14} color={PALETTE.link} />
              </>
            ) : null}
          </Text>
        );
      },
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
    [handleLinkPress, markLinksLeavingApp],
  );

  const markdownStyles = useMemo(
    () => ({
      body: {
        ...(small ? textStyles.bodySmall : textStyles.body),
        color: PALETTE.text,
      },
      paragraph: { marginTop: 0, marginBottom: 0 },
      strong: textStyles.strong,
      link: { color: PALETTE.link, textDecorationLine: "underline" as const },
    }),
    [small, textStyles.body, textStyles.bodySmall, textStyles.strong],
  );

  return (
    <Markdown style={markdownStyles} rules={rules} mergeStyle>
      {children}
    </Markdown>
  );
};

export default InlineLabelMarkdownWrapper;
