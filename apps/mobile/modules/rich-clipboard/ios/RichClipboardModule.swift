import ExpoModulesCore
import UIKit
import UniformTypeIdentifiers

// iOS paste targets read html through NSAttributedString, which sets unstyled
// text in Times, so the html names the system font.
private func withSystemFont(_ html: String) -> String {
  "<div style=\"font-family: -apple-system, sans-serif\">\(html)</div>"
}

public class RichClipboardModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RichClipboard")

    // One item carrying both types, so a paste target takes the one it reads.
    // expo-clipboard's html setter would derive the plain text from the html instead.
    AsyncFunction("setHtmlAsync") { (html: String, text: String) in
      UIPasteboard.general.setItems([[
        UTType.html.identifier: withSystemFont(html),
        UTType.utf8PlainText.identifier: text,
      ]])
    }.runOnQueue(.main)
  }
}
