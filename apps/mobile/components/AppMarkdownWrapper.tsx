import { RelativePathString, router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Image,
  Linking,
  StyleProp,
  TextStyle,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import Markdown, { ASTNode, RenderRules } from "react-native-markdown-display";
import { getApiUrl } from "../lib/config";
import { ImageLightboxModal } from "./ImageLightbox";
import { renderListItem } from "./markdownListItem";
import {
  MARKDOWN_FILL_WIDTH_STYLE,
  MARKDOWN_PALETTES,
  MarkdownTone,
  useMarkdownTextStyles,
  type MarkdownLayoutStyle,
} from "./markdownStyles";
import Text from "./system/Text";

/**
 * Route patterns that can be handled internally by the mobile app.
 * Each pattern is a regex that matches a relative URL path.
 * Use capturing groups to extract route parameters.
 */
const INTERNAL_ROUTE_PATTERNS: {
  pattern: RegExp;
  getRoute: (match: RegExpMatchArray) => string;
}[] = [
  // Action activity detail: /actions/123/activity/456
  {
    pattern: /^\/actions?\/(\d+)\/activity\/(\d+)\/?$/,
    getRoute: (match) => `/actions/${match[1]}/activity/${match[2]}`,
  },
  // Action pages: /actions/123 or /action/123
  {
    pattern: /^\/actions?\/(\d+)\/?$/,
    getRoute: (match) => `/actions/${match[1]}`,
  },
  // Actions list: /actions
  {
    pattern: /^\/actions\/?$/,
    getRoute: () => "/actions",
  },
  // Forum index: /forum
  {
    pattern: /^\/forum\/?$/,
    getRoute: () => "/forum",
  },
  // Forum post: /forum/post/123 or /forum/123
  {
    pattern: /^\/forum\/(?:post\/)?(\d+)\/?$/,
    getRoute: (match) => `/forum/post/${match[1]}`,
  },
  // Member profile: /member/123
  {
    pattern: /^\/member\/(\d+)\/?$/,
    getRoute: (match) => `/member/${match[1]}`,
  },
  // Messages list: /messages
  {
    pattern: /^\/messages\/?$/,
    getRoute: () => "/messages",
  },
  // Activity feed: /feed
  {
    pattern: /^\/feed\/?$/,
    getRoute: () => "/feed",
  },
  // User profile: /profile
  {
    pattern: /^\/profile\/?$/,
    getRoute: () => "/profile",
  },
  // Settings: /settings
  {
    pattern: /^\/settings\/?$/,
    getRoute: () => "/settings",
  },
  // Notifications: /notifications
  {
    pattern: /^\/notifications\/?$/,
    getRoute: () => "/notifications",
  },
  // Membership: /membership or /contract
  {
    pattern: /^\/(?:membership|contract)\/?$/,
    getRoute: () => "/membership",
  },
  // Groups: /groups
  {
    pattern: /^\/groups\/?$/,
    getRoute: () => "/groups",
  },
  // Invites: /invites
  {
    pattern: /^\/invites\/?$/,
    getRoute: () => "/invites",
  },
  // Information: /information
  {
    pattern: /^\/information\/?$/,
    getRoute: () => "/information",
  },
  // Search: /search
  {
    pattern: /^\/search\/?$/,
    getRoute: () => "/search",
  },
];

/**
 * Check if a URL is a relative path that can be handled internally
 */
function getInternalRoute(url: string): string | null {
  // Only process relative URLs (starting with /)
  if (!url.startsWith("/")) {
    return null;
  }

  // Extract query string and hash to preserve them
  const queryIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");
  const suffixStart =
    queryIndex >= 0 && hashIndex >= 0
      ? Math.min(queryIndex, hashIndex)
      : queryIndex >= 0
        ? queryIndex
        : hashIndex;
  const pathOnly = suffixStart >= 0 ? url.slice(0, suffixStart) : url;
  const suffix = suffixStart >= 0 ? url.slice(suffixStart) : "";

  for (const { pattern, getRoute } of INTERNAL_ROUTE_PATTERNS) {
    const match = pathOnly.match(pattern);
    if (match) {
      return getRoute(match) + suffix;
    }
  }

  return null;
}

function useHandleLinkPress() {
  return useCallback((url: string): boolean => {
    // Check if this is an internal route we can handle (relative URL)
    let internalRoute = getInternalRoute(url);

    // If not a relative match, check if it's an absolute URL to our domain
    if (!internalRoute) {
      const extractedPath = extractPathFromInternalUrl(url);
      if (extractedPath) {
        internalRoute = getInternalRoute(extractedPath);
      }
    }

    if (internalRoute) {
      router.push(internalRoute as RelativePathString);
      return false; // Prevent default handling
    }

    // For external URLs, open in browser
    if (url.startsWith("http://") || url.startsWith("https://")) {
      Linking.openURL(url).catch((err) => {
        console.error("Failed to open URL:", err);
      });
      return false;
    }

    // For mailto: and other protocols
    if (url.includes(":")) {
      Linking.openURL(url).catch((err) => {
        console.error("Failed to open URL:", err);
      });
      return false;
    }

    // For relative URLs that don't match internal routes, open on web
    const webUrl = `https://worldalliance.org${
      url.startsWith("/") ? "" : "/"
    }${url}`;
    Linking.openURL(webUrl).catch((err) => {
      console.error("Failed to open URL:", err);
    });
    return false;
  }, []);
}

/**
 * Domains that should be treated as "our" website for internal route matching
 */
const INTERNAL_DOMAINS = ["worldalliance.org", "www.worldalliance.org"];

/**
 * Extract the path from a URL if it's from one of our internal domains
 * Returns null if the URL is not from an internal domain
 */
function extractPathFromInternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (INTERNAL_DOMAINS.includes(hostname)) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // Not a valid URL, ignore
  }
  return null;
}

/**
 * Transform image URLs to use the API server for relative paths
 */
function transformImageUrl(url: string): string {
  // Handle imgcap code blocks and relative image paths
  if (url.includes(".webp") && !url.startsWith("http")) {
    return `${getApiUrl()}/images/${url}`;
  }
  // Handle relative paths without extension check
  if (!url.startsWith("http") && !url.startsWith("data:")) {
    return `${getApiUrl()}/images/${url}`;
  }
  return url;
}

/** Match sharedweb AppMarkdownWrapper Tailwind: `mt-6` / headings */
const MD_SPACE_HEADING_TOP = 24;
/** `mt-4` / paragraphs */
const MD_SPACE_PARAGRAPH_TOP = 16;
/** `mt-2` / lists & list items */
const MD_SPACE_LIST_TOP = 8;
/** `my-4` / blockquote */
const MD_SPACE_BLOCKQUOTE = 16;

function isFirstAmongSiblings(node: ASTNode): boolean {
  return node.index === 0;
}

function isLastAmongSiblings(node: ASTNode, parentNodes: ASTNode[]): boolean {
  const parent = parentNodes[0];
  if (!parent?.children?.length) return true;
  return node.index === parent.children.length - 1;
}

function renderPlainCodeBlock(params: {
  node: ASTNode;
  parent: ASTNode[];
  codeStyle: TextStyle;
}) {
  const { node, parent, codeStyle } = params;
  return (
    <View
      key={node.key}
      style={{
        backgroundColor: "#f4f4f5",
        padding: 12,
        borderRadius: 4,
        marginTop: isFirstAmongSiblings(node) ? 0 : MD_SPACE_LIST_TOP,
        marginBottom: isLastAmongSiblings(node, parent) ? 0 : MD_SPACE_LIST_TOP,
      }}
    >
      <Text style={codeStyle}>{node.content || ""}</Text>
    </View>
  );
}

function renderHeading(params: {
  node: ASTNode;
  children: React.ReactNode;
  viewSafeStyle: StyleProp<ViewStyle>;
}) {
  const { node, children, viewSafeStyle } = params;
  return (
    <View
      key={node.key}
      style={[
        viewSafeStyle,
        {
          marginTop: isFirstAmongSiblings(node) ? 0 : MD_SPACE_HEADING_TOP,
          marginBottom: 0,
        },
      ]}
    >
      {children}
    </View>
  );
}

const TRUNCATED_PREVIEW_LINES = 3;

interface AppMarkdownWrapperProps {
  /** Prefer this name to match sharedweb `AppMarkdownWrapper` */
  markdownContent?: string;
  children?: string;
  style?: MarkdownLayoutStyle;
  truncated?: boolean;
  small?: boolean;
  tone?: MarkdownTone;
}

const AppMarkdownWrapper: React.FC<AppMarkdownWrapperProps> = ({
  markdownContent,
  children,
  style,
  truncated = false,
  small = false,
  tone = MarkdownTone.Default,
}) => {
  const markdownSource = markdownContent ?? children ?? "";
  const handleLinkPress = useHandleLinkPress();
  const textStyles = useMarkdownTextStyles();
  const palette = MARKDOWN_PALETTES[tone];
  const { fontScale } = useWindowDimensions();
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  const wrapImage = useCallback(
    (image: React.ReactNode, src: string) =>
      truncated ? (
        image
      ) : (
        <TouchableOpacity
          activeOpacity={0.9}
          style={{ width: "100%" }}
          onPress={() => setLightboxUri(src)}
        >
          {image}
        </TouchableOpacity>
      ),
    [truncated],
  );

  const renderImgcap = useCallback(
    (node: ASTNode, parent: ASTNode[]) => {
      const [imgLine, ...captionLines] = (node.content || "").split("\n");
      const img = imgLine.trim();
      const caption = captionLines.join("\n").trim();
      const transformedSrc = `${getApiUrl()}/images/${img}`;

      return (
        <View
          key={node.key}
          style={{
            alignItems: "center",
            marginTop: isFirstAmongSiblings(node) ? 0 : 24,
            marginBottom: isLastAmongSiblings(node, parent) ? 0 : 24,
          }}
        >
          {wrapImage(
            <Image
              source={{ uri: transformedSrc }}
              style={{
                width: "100%",
                maxHeight: 300,
                borderRadius: 4,
              }}
              resizeMode="contain"
            />,
            transformedSrc,
          )}
          {caption ? (
            <Text
              style={{
                ...textStyles.caption,
                color: palette.caption,
                marginTop: 8,
                textAlign: "center",
              }}
            >
              {caption}
            </Text>
          ) : null}
        </View>
      );
    },
    [wrapImage, textStyles.caption, palette.caption],
  );

  const rules: RenderRules = useMemo(
    () => ({
      heading1: (node, children, _parent, styles) =>
        renderHeading({
          node,
          children,
          viewSafeStyle: styles._VIEW_SAFE_heading1,
        }),
      heading2: (node, children, _parent, styles) =>
        renderHeading({
          node,
          children,
          viewSafeStyle: styles._VIEW_SAFE_heading2,
        }),
      heading3: (node, children, _parent, styles) =>
        renderHeading({
          node,
          children,
          viewSafeStyle: styles._VIEW_SAFE_heading3,
        }),
      heading4: (node, children, _parent, styles) =>
        renderHeading({
          node,
          children,
          viewSafeStyle: styles._VIEW_SAFE_heading4,
        }),
      heading5: (node, children, _parent, styles) =>
        renderHeading({
          node,
          children,
          viewSafeStyle: styles._VIEW_SAFE_heading5,
        }),
      heading6: (node, children, _parent, styles) =>
        renderHeading({
          node,
          children,
          viewSafeStyle: styles._VIEW_SAFE_heading6,
        }),
      paragraph: (node, children, parent, styles) => {
        const inListItem = parent[0]?.type === "list_item";
        const marginTop = inListItem
          ? 0
          : isFirstAmongSiblings(node)
            ? 0
            : MD_SPACE_PARAGRAPH_TOP;
        return (
          <View
            key={node.key}
            style={[
              styles._VIEW_SAFE_paragraph,
              { marginTop, marginBottom: 0 },
            ]}
          >
            {children}
          </View>
        );
      },
      bullet_list: (node, children, _parent, styles) => (
        <View
          key={node.key}
          style={[
            styles._VIEW_SAFE_bullet_list,
            {
              marginTop: isFirstAmongSiblings(node) ? 0 : MD_SPACE_LIST_TOP,
              marginBottom: 0,
            },
          ]}
        >
          {children}
        </View>
      ),
      ordered_list: (node, children, _parent, styles) => (
        <View
          key={node.key}
          style={[
            styles._VIEW_SAFE_ordered_list,
            {
              marginTop: isFirstAmongSiblings(node) ? 0 : MD_SPACE_LIST_TOP,
              marginBottom: 0,
            },
          ]}
        >
          {children}
        </View>
      ),
      list_item: (node, children, parent, _styles, inheritedStyles = {}) =>
        renderListItem({
          node,
          children,
          parent,
          inheritedStyles,
          fontScale,
          marginTop: isFirstAmongSiblings(node) ? 0 : MD_SPACE_LIST_TOP,
        }),
      blockquote: (node, children, parent, styles) => (
        <View
          key={node.key}
          style={[
            styles._VIEW_SAFE_blockquote,
            {
              // Match web `my-4` top; omit bottom margin unless last (no CSS margin-collapse in RN).
              marginTop: MD_SPACE_BLOCKQUOTE,
              marginBottom: isLastAmongSiblings(node, parent)
                ? MD_SPACE_BLOCKQUOTE
                : 0,
            },
          ]}
        >
          {children}
        </View>
      ),
      // custom image rendering with URL transformation
      image: (node, _children, parent) => {
        const src = node.attributes?.src || "";
        const transformedSrc = transformImageUrl(src);
        const alt = node.attributes?.alt || "";

        return (
          <View
            key={node.key}
            style={{
              marginTop: isFirstAmongSiblings(node) ? 0 : MD_SPACE_LIST_TOP,
              marginBottom: isLastAmongSiblings(node, parent)
                ? 0
                : MD_SPACE_LIST_TOP,
            }}
          >
            {wrapImage(
              <Image
                source={{ uri: transformedSrc }}
                style={{
                  aspectRatio: 1,
                  width: "100%",
                  borderRadius: 4,
                }}
                resizeMode="contain"
                accessibilityLabel={alt}
              />,
              transformedSrc,
            )}
          </View>
        );
      },
      // Custom link rendering
      link: (node, children, _parent, styles) => {
        const href = node.attributes?.href || "";
        return (
          <Text
            style={styles.link}
            onPress={() => handleLinkPress(href)}
            key={node.key}
          >
            {children}
          </Text>
        );
      },
      // Handle imgcap code blocks (custom image with caption syntax)
      code_block: (node, _children, parent) => {
        const language = node.attributes?.class?.replace("language-", "") || "";
        return language === "imgcap"
          ? renderImgcap(node, parent)
          : renderPlainCodeBlock({ node, parent, codeStyle: textStyles.code });
      },
      body: (_node, children) => <>{children}</>,
      fence: (node, _children, parent) => {
        // The info string (language) for fenced code blocks can be in different properties
        const info =
          (node as { sourceInfo?: string }).sourceInfo ||
          (node.attributes as { info?: string })?.info ||
          "";
        return info === "imgcap"
          ? renderImgcap(node, parent)
          : renderPlainCodeBlock({ node, parent, codeStyle: textStyles.code });
      },
    }),
    [handleLinkPress, wrapImage, renderImgcap, textStyles.code, fontScale],
  );

  const bodyStyle = small ? textStyles.bodySmall : textStyles.body;

  const markdownStyles = useMemo(
    () => ({
      body: {
        ...bodyStyle,
        color: palette.text,
      },
      heading1: {
        ...textStyles.heading1,
        color: palette.text,
      },
      heading2: {
        ...textStyles.heading2,
        color: palette.text,
      },
      heading3: {
        ...textStyles.heading3,
        color: palette.text,
      },
      heading4: {
        ...textStyles.heading4,
        color: palette.text,
      },
      heading5: {
        ...textStyles.heading5,
        color: palette.text,
      },
      heading6: {
        ...textStyles.heading6,
        color: palette.text,
      },
      paragraph: {},
      ...MARKDOWN_FILL_WIDTH_STYLE,
      strong: textStyles.strong,
      link: {
        color: palette.link,
        textDecorationLine: "underline" as const,
      },
      blockquote: {
        borderLeftWidth: 2,
        borderLeftColor: palette.blockquoteBorder,
        paddingLeft: 12,
        backgroundColor: palette.blockquoteBackground,
      },
      bullet_list: {},
      ordered_list: {},
      code_inline: {
        ...textStyles.codeInline,
        backgroundColor: palette.codeInlineBackground,
      },
      ...style,
    }),
    [style, textStyles, bodyStyle, palette],
  );

  // Undefined until the theme resolves, which leaves the preview unclamped for a
  // frame rather than collapsing it to zero height.
  const truncatedMaxHeight = bodyStyle.lineHeight
    ? bodyStyle.lineHeight * TRUNCATED_PREVIEW_LINES
    : undefined;

  return (
    <>
      {truncated ? (
        <View
          className="overflow-hidden"
          style={{ maxHeight: truncatedMaxHeight }}
        >
          <Markdown style={markdownStyles} rules={rules} mergeStyle>
            {markdownSource}
          </Markdown>
        </View>
      ) : (
        <Markdown style={markdownStyles} rules={rules} mergeStyle>
          {markdownSource}
        </Markdown>
      )}
      <ImageLightboxModal
        uri={lightboxUri}
        onClose={() => setLightboxUri(null)}
      />
    </>
  );
};

export default AppMarkdownWrapper;

export {
  extractPathFromInternalUrl,
  getInternalRoute,
  INTERNAL_DOMAINS,
  INTERNAL_ROUTE_PATTERNS,
  transformImageUrl,
  useHandleLinkPress,
};
