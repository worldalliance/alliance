package com.alliance.appiconbadge

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import me.leolin.shortcutbadger.ShortcutBadger

class AppIconBadgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppIconBadge")

    AsyncFunction("clearAsync") {
      val context = requireNotNull(appContext.reactContext) { "React context is null" }
      ShortcutBadger.removeCount(context.applicationContext)
    }
  }
}
