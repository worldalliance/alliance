import type { CustomHtmlField as CustomHtmlFieldSchema } from "@alliance/common/forms/form-schema";
import { buildCustomHtmlDocument } from "@alliance/shared/forms/customHtml";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { useHandleLinkPress } from "../AppMarkdownWrapper";

/**
 * On web the authored markup sits in the page; here it can only live in a
 * WebView, so the same `Alliance` runtime is built inside the document and the
 * answer is posted back out. The authored script sees the API it was written
 * against — what it cannot see, unlike on web, is the rest of the app.
 */
export default function CustomHtmlField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: CustomHtmlFieldSchema;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const [height, setHeight] = useState(0);
  const handleLinkPress = useHandleLinkPress();

  // Rebuilding the document on every answer would reload the WebView and throw
  // away the widget's own state mid-interaction, so the saved answer is baked
  // in once and updates only flow outward.
  const source = useMemo(
    () =>
      buildCustomHtmlDocument({
        field,
        initialValue: value ?? "",
        postFunction: `function (message) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }`,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [field.html, field.css, field.js],
  );

  return (
    <View
      style={{ height, opacity: disabled ? 0.6 : 1 }}
      pointerEvents={disabled ? "none" : "auto"}
    >
      <WebView
        source={{ html: source }}
        originWhitelist={["*"]}
        onMessage={({ nativeEvent }) => {
          let message: { type?: string; height?: number; value?: string };
          try {
            message = JSON.parse(nativeEvent.data);
          } catch {
            return;
          }
          if (message.type === "height") {
            const reported = Number(message.height);
            if (Number.isFinite(reported) && reported > 0) setHeight(reported);
          } else if (message.type === "value") {
            onChange?.(String(message.value ?? ""));
          }
        }}
        onShouldStartLoadWithRequest={({ url }) => {
          // Everything but the initial in-memory document is a tapped link,
          // which belongs in the browser or an in-app route.
          if (url === "about:blank") return true;
          handleLinkPress(url);
          return false;
        }}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        automaticallyAdjustContentInsets={false}
        style={{ backgroundColor: "transparent", opacity: height ? 1 : 0 }}
      />
    </View>
  );
}
