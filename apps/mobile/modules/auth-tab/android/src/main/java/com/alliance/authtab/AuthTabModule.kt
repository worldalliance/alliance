package com.alliance.authtab

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.browser.auth.AuthTabIntent
import androidx.browser.customtabs.CustomTabsClient
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val AUTH_TAB_REQUEST_CODE = 7141
private const val TAG = "AuthTab"

class AuthTabModule : Module() {
  // OnActivityResult arrives through the React context, which outlives the
  // activity, so pending settles even when Android recreates the activity.
  private var pending: Promise? = null

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is null" }

  override fun definition() = ModuleDefinition {
    Name("AuthTab")

    Function("isSupported") {
      authTabBrowser(context) != null
    }

    AsyncFunction("openAsync") { url: String, redirectUrl: String, promise: Promise ->
      if (pending != null) {
        throw CodedException("ERR_AUTH_TAB_PENDING", "An Auth Tab is already open", null)
      }
      val activity = appContext.throwingActivity
      activity.startActivityForResult(authTabIntent(activity, url, redirectUrl), AUTH_TAB_REQUEST_CODE)
      pending = promise
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, (requestCode, resultCode, data) ->
      if (requestCode != AUTH_TAB_REQUEST_CODE) {
        return@OnActivityResult
      }
      val promise = pending
      if (promise == null) {
        Log.w(TAG, "Dropped Auth Tab result $resultCode with no open() waiting")
        return@OnActivityResult
      }
      pending = null
      val type = when (resultCode) {
        AuthTabIntent.RESULT_OK -> "success"
        AuthTabIntent.RESULT_CANCELED -> "cancel"
        AuthTabIntent.RESULT_VERIFICATION_FAILED -> "verification_failed"
        AuthTabIntent.RESULT_VERIFICATION_TIMED_OUT -> "verification_timed_out"
        else -> "unknown"
      }
      promise.resolve(mapOf("type" to type, "resultCode" to resultCode, "url" to data?.data?.toString()))
    }
  }
}

private fun authTabBrowser(context: Context): String? =
  CustomTabsClient.getPackageName(context, null)
    ?.takeIf { CustomTabsClient.isAuthTabSupported(context, it) }

private fun authTabIntent(context: Context, url: String, redirectUrl: String): Intent {
  val browser = authTabBrowser(context)
    ?: throw CodedException("ERR_AUTH_TAB_UNSUPPORTED", "The default browser has no Auth Tab", null)
  val redirect = Uri.parse(redirectUrl)
  return AuthTabIntent.Builder().build().intent.apply {
    setPackage(browser)
    data = Uri.parse(url)
    if (redirect.scheme == "https") {
      putExtra(AuthTabIntent.EXTRA_HTTPS_REDIRECT_HOST, redirect.host)
      putExtra(AuthTabIntent.EXTRA_HTTPS_REDIRECT_PATH, redirect.path)
    } else {
      putExtra(AuthTabIntent.EXTRA_REDIRECT_SCHEME, redirect.scheme)
    }
  }
}
