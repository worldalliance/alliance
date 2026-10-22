package com.alliance.richclipboard

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RichClipboardModule : Module() {
  private val clipboard: ClipboardManager
    get() = requireNotNull(appContext.reactContext) { "React context is null" }
      .getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager

  override fun definition() = ModuleDefinition {
    Name("RichClipboard")

    AsyncFunction("setHtmlAsync") { html: String, text: String ->
      clipboard.setPrimaryClip(ClipData.newHtmlText(null, text, html))
    }
  }
}
