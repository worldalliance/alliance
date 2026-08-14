import { useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { useHandleLinkPress } from "../AppMarkdownWrapper";

// Authored HTML brings its own <style>, so these only set defaults it can
// override: they come first in the document and use no extra specificity.
const BASE_STYLES = `
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    line-height: 1.5;
    color: #18181b;
    overflow-wrap: break-word;
    -webkit-text-size-adjust: 100%;
  }
  a { color: rgb(98, 161, 36); }
  img, video { max-width: 100%; height: auto; }
  /* Tables are authored at desktop widths; scroll them instead of letting one
     widen the whole document past the screen. */
  table { display: block; max-width: 100%; overflow-x: auto; }
`;

// The WebView can't size itself, so the document reports its height back.
const REPORT_HEIGHT = `
  (function () {
    function post() {
      window.ReactNativeWebView.postMessage(
        String(document.documentElement.scrollHeight),
      );
    }
    new ResizeObserver(post).observe(document.documentElement);
    post();
  })();
  true;
`;

function documentFor(html: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${BASE_STYLES}</style>
  </head>
  <body>${html}</body>
</html>`;
}

export default function HtmlBlock({ html }: { html: string }) {
  const [height, setHeight] = useState(0);
  const handleLinkPress = useHandleLinkPress();

  return (
    <View style={{ height }}>
      <WebView
        source={{ html: documentFor(html) }}
        originWhitelist={["*"]}
        injectedJavaScript={REPORT_HEIGHT}
        onMessage={({ nativeEvent }) => {
          const reported = Number(nativeEvent.data);
          if (Number.isFinite(reported) && reported > 0) {
            setHeight(reported);
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
