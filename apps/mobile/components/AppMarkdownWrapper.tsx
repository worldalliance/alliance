import React, { useCallback, useMemo } from "react";
import { Linking, Image, View } from "react-native";
import Markdown, { RenderRules } from "react-native-markdown-display";
import { RelativePathString, router } from "expo-router";
import { getApiUrl } from "../lib/config";
import { colors } from "../lib/style/colors";
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
  // Action pages: /actions/123 or /action/123
  {
    pattern: /^\/actions?\/(\d+)$/,
    getRoute: (match) => `/actions/${match[1]}`,
  },
  // Forum index: /forum
  {
    pattern: /^\/forum\/?$/,
    getRoute: () => "/forum",
  },
  // Forum post: /forum/post/123 or /forum/123
  {
    pattern: /^\/forum\/(?:post\/)?(\d+)$/,
    getRoute: (match) => `/forum/post/${match[1]}`,
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
  // Actions list: /actions
  {
    pattern: /^\/actions\/?$/,
    getRoute: () => "/actions",
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

interface AppMarkdownWrapperProps {
  children: string;
  style?: object;
}

const AppMarkdownWrapper: React.FC<AppMarkdownWrapperProps> = ({
  children,
  style,
}) => {
  const handleLinkPress = useHandleLinkPress();

  const rules: RenderRules = useMemo(
    () => ({
      // Custom image rendering with URL transformation
      image: (node, children, parent, styles) => {
        const src = node.attributes?.src || "";
        const transformedSrc = transformImageUrl(src);
        const alt = node.attributes?.alt || "";

        return (
          <View key={node.key} style={{ marginVertical: 8 }}>
            <Image
              source={{ uri: transformedSrc }}
              style={{
                width: "100%",
                height: 200,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: "#e4e4e7",
              }}
              resizeMode="cover"
              accessibilityLabel={alt}
            />
          </View>
        );
      },
      // Custom link rendering
      link: (node, children, parent, styles) => {
        const href = node.attributes?.href || "";
        return (
          <Text
            style={{ color: colors.green, textDecorationLine: "underline" }}
            onPress={() => handleLinkPress(href)}
            key={node.key}
          >
            {children}
          </Text>
        );
      },
      // Handle imgcap code blocks (custom image with caption syntax)
      code_block: (node, children, parent, styles) => {
        const content = node.content || "";
        const language = node.attributes?.class?.replace("language-", "") || "";

        if (language === "imgcap") {
          const [imgLine, ...captionLines] = content.split("\n");
          const img = imgLine.trim();
          const caption = captionLines.join("\n").trim();
          const transformedSrc = `${getApiUrl()}/images/${img}`;

          return (
            <View
              key={node.key}
              style={{ alignItems: "center", marginVertical: 12 }}
            >
              <Image
                source={{ uri: transformedSrc }}
                style={{
                  width: "100%",
                  maxHeight: 300,
                  borderRadius: 4,
                }}
                resizeMode="contain"
              />
              {caption ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  {caption}
                </Text>
              ) : null}
            </View>
          );
        }

        // Default code block rendering
        return (
          <View
            key={node.key}
            style={{
              backgroundColor: "#f4f4f5",
              padding: 12,
              borderRadius: 4,
              marginVertical: 8,
            }}
          >
            <Text style={{ fontFamily: "monospace", fontSize: 13 }}>
              {content}
            </Text>
          </View>
        );
      },
      body: (node, children) => <>{children}</>,
      fence: (node, children, parent, styles) => {
        const content = node.content || "";
        // The info string (language) for fenced code blocks can be in different properties
        const info =
          (node as { sourceInfo?: string }).sourceInfo ||
          (node.attributes as { info?: string })?.info ||
          "";

        if (info === "imgcap") {
          const [imgLine, ...captionLines] = content.split("\n");
          const img = imgLine.trim();
          const caption = captionLines.join("\n").trim();
          const transformedSrc = `${getApiUrl()}/images/${img}`;

          return (
            <View
              key={node.key}
              style={{ alignItems: "center", marginVertical: 12 }}
            >
              <Image
                source={{ uri: transformedSrc }}
                style={{
                  width: "100%",
                  maxHeight: 300,
                  borderRadius: 4,
                }}
                resizeMode="contain"
              />
              {caption ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  {caption}
                </Text>
              ) : null}
            </View>
          );
        }

        // Default fence rendering
        return (
          <View
            key={node.key}
            style={{
              backgroundColor: "#f4f4f5",
              padding: 12,
              borderRadius: 4,
              marginVertical: 8,
            }}
          >
            <Text style={{ fontFamily: "monospace", fontSize: 13 }}>
              {content}
            </Text>
          </View>
        );
      },
    }),
    [handleLinkPress]
  );

  const markdownStyles = useMemo(
    () => ({
      body: {
        fontSize: 15,
        lineHeight: 22,
        color: "#18181b",
      },
      heading1: {
        fontSize: 20,
        fontWeight: "600" as const,
        marginTop: 16,
        marginBottom: 8,
        color: "#18181b",
      },
      heading2: {
        fontSize: 18,
        fontWeight: "600" as const,
        marginTop: 14,
        marginBottom: 6,
        color: "#18181b",
      },
      heading3: {
        fontSize: 16,
        fontWeight: "600" as const,
        marginTop: 12,
        marginBottom: 4,
        color: "#18181b",
      },
      paragraph: {
        marginTop: 0,
        marginBottom: 10,
      },
      strong: {
        fontWeight: "600" as const,
      },
      link: {
        color: colors.green,
        textDecorationLine: "underline" as const,
      },
      blockquote: {
        borderLeftWidth: 2,
        borderLeftColor: "#d4d4d8",
        paddingLeft: 12,
        marginVertical: 8,
        backgroundColor: "#fafafa",
      },
      bullet_list: {
        marginVertical: 8,
      },
      bullet_list_icon: {
        fontSize: 35,
        top: 7,
      },
      ordered_list: {
        marginVertical: 8,
      },
      list_item: {
        marginVertical: 2,
      },
      code_inline: {
        backgroundColor: "#f4f4f5",
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 2,
        fontFamily: "monospace",
        fontSize: 13,
      },
      ...style,
    }),
    [style]
  );

  return (
    <Markdown style={markdownStyles} rules={rules} mergeStyle>
      {children}
    </Markdown>
  );
};

export default AppMarkdownWrapper;

export {
  getInternalRoute,
  extractPathFromInternalUrl,
  transformImageUrl,
  INTERNAL_ROUTE_PATTERNS,
  INTERNAL_DOMAINS,
  useHandleLinkPress,
};
