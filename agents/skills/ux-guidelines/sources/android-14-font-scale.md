# Features and APIs Overview

Source: <https://developer.android.com/about/versions/14/features>

Retrieved: 2026-11-09

Portions of this page are reproduced from work created and shared by the Android Open Source Project and used according to terms described in the Creative Commons 2.5 Attribution License (https://creativecommons.org/licenses/by/2.5/). Converted from HTML to Markdown, with the site's navigation, header and footer left out.

---

Android 14 introduces great features and APIs for developers. The following help you learn about features for your apps and get started with the related APIs.

For a detailed list of added, modified, and removed APIs, read the [API diff report](/sdk/api_diff/34/changes). For details on added APIs visit the [Android API reference](/reference) — for Android 14, look for APIs that were added in API level 34. To learn about areas where platform changes might affect your apps, be sure to check out Android 14 behavior changes [for apps that target Android 14](/about/versions/14/behavior-changes-14) and [for all apps](/about/versions/14/behavior-changes-all).

## Internationalization

### Per-app language preferences

Android 14 expands on the [per-app language](/guide/topics/resources/app-languages) features that were introduced in Android 13 (API level 33) with these additional capabilities:

- **Automatically generate an app's `localeConfig`**: Starting with Android Studio Giraffe Canary 7 and AGP 8.1.0-alpha07, you can configure your app to support [per-app language preferences](/guide/topics/resources/app-languages) automatically. Based on your project resources, the Android Gradle plugin generates the `LocaleConfig` file and adds a reference to it in the final manifest file, so you no longer have to create or update the file manually. AGP uses the resources in the `res` folders of your app modules and any library module dependencies to determine the locales to include in the `LocaleConfig` file.

- **Dynamic updates for an app's `localeConfig`**: Use the [`setOverrideLocaleConfig()`](</reference/android/app/LocaleManager#setOverrideLocaleConfig(android.app.LocaleConfig)>) and [`getOverrideLocaleConfig()`](</reference/android/app/LocaleManager#getOverrideLocaleConfig()>) methods in [`LocaleManager`](/reference/android/app/LocaleManager) to dynamically update your app's list of supported languages in the [device's system settings](/guide/topics/resources/app-languages#app-language-settings). Use this flexibility to customize the list of supported languages per region, run A/B experiments, or provide an updated list of locales if your app utilizes server-side pushes for localization.

- **App language visibility for input method editors (IMEs)**: IMEs can utilize the [`getApplicationLocales()`](</reference/android/app/LocaleManager#getApplicationLocales(java.lang.String)>) method to check the language of the current app and match the IME language to that language.

### Grammatical Inflection API

3 billion people speak _gendered languages_: languages where grammatical categories—such as nouns, verbs, adjectives, and prepositions—inflect according to the gender of people and objects you talk to or about. Traditionally, many gendered languages use masculine grammatical gender as the default or _generic_ gender.

Addressing users in the wrong grammatical gender, such as addressing women in masculine grammatical gender, can [negatively impact](https://www.nature.com/articles/s41539-021-00087-7) their performance and attitude. In contrast, a UI with language that correctly reflects the user's grammatical gender can improve user engagement and provide a more personalized and natural-sounding user experience.

To help you build a user-centric UI for gendered languages, Android 14 introduces the [Grammatical Inflection API](/about/versions/14/features/grammatical-inflection), which lets you add support for grammatical gender without refactoring your app.

### Regional preferences

Regional preferences enable users to personalize temperature units, the first day of the week, and numbering systems. A European living in the United States might prefer temperature units to be in Celsius rather than Fahrenheit and for apps to treat Monday as the beginning of the week instead of the US default of Sunday.

New Android Settings menus for these preferences provide users with a discoverable and centralized location to change app preferences. These preferences also persist through backup and restore. Several APIs and intents—such as [`getTemperatureUnit`](</reference/androidx/core/text/util/LocalePreferences#getTemperatureUnit()>) and [`getFirstDayOfWeek`](</reference/androidx/core/text/util/LocalePreferences#getFirstDayOfWeek()>)— grant your app read access to user preferences, so your app can adjust how it displays information. You can also register a `BroadcastReceiver` on [`ACTION_LOCALE_CHANGED`](/reference/android/content/Intent#ACTION_LOCALE_CHANGED) to handle locale configuration changes when regional preferences change.

To find these settings, open the Settings app and navigate to **System > Languages & input > Regional preferences**.

![](/static/about/versions/14/images/regional-preferences.png)

Regional preferences screen in Android system settings.

![](/static/about/versions/14/images/regional-preferences-temperature.png)

Temperature options for regional preferences in Android system settings.

## Accessibility

### Non-linear font scaling to 200%

Starting in Android 14, the system supports font scaling up to 200%, providing users with additional accessibility options.

To prevent large text elements on screen from scaling too large, the system applies a nonlinear scaling curve. This scaling strategy means that large text doesn't scale at the same rate as smaller text. Nonlinear font scaling helps preserve the proportional hierarchy between elements of different sizes while mitigating issues with linear text scaling at high degrees (such as text being cut off or text that becomes harder to read due to an extremely large display sizes).

#### Test your app with nonlinear font scaling

![](/static/images/about/versions/14/accessibility-font-options.png)

Enable the maximum font size in a device's accessibility settings to test your app.

If you already use scaled pixels (sp) units to define text sizing, then these additional options and scaling improvements are applied automatically to the text in your app. However, you should still perform UI testing with the maximum font size enabled (200%) to ensure that your app applies the font sizes correctly and can accommodate larger font sizes without impacting usability.

To enable 200% font size, follow these steps:

1.  Open the Settings app and navigate to **Accessibility > Display size and text**.
2.  For the **Font size** option, tap the plus (+) icon until the maximum font size setting is enabled, as shown in the image that accompanies this section.

#### Use scaled pixel (sp) units for text-sizes

Remember to always [specify text sizes in sp units](/training/multiscreen/screendensities#TaskUseDP). When your app uses sp units, Android can apply the user's preferred text size and scale it appropriately.

Don't use sp units for padding or define view heights assuming implicit padding: with nonlinear font scaling sp dimensions might not be proportional, so 4sp + 20sp might not equal 24sp.

#### Convert scaled pixel (sp) units

Use [`TypedValue.applyDimension()`](</reference/android/util/TypedValue#applyDimension(int,%20float,%20android.util.DisplayMetrics)>) to convert from sp units to pixels, and use [`TypedValue.deriveDimension()`](</reference/android/util/TypedValue#deriveDimension(int,%20float,%20android.util.DisplayMetrics)>) to convert pixels to sp. These methods apply the appropriate nonlinear scaling curve automatically.

[Avoid hardcoding equations](/training/multiscreen/screendensities#dips-pels) using [`Configuration.fontScale`](/reference/android/content/res/Configuration#fontScale) or [`DisplayMetrics.scaledDensity`](/reference/kotlin/android/util/DisplayMetrics#scaleddensity). Because font scaling is nonlinear, the `scaledDensity` field is no longer accurate. The `fontScale` field should be used for informational purposes only because fonts are no longer scaled with a single scalar value.

#### Use sp units for lineHeight

Always define [`android:lineHeight`](/reference/android/widget/TextView#attr_android:lineHeight) using sp units instead of dp, so the line height scales along with your text. Otherwise, if your text is sp but your `lineHeight` is in dp or px, it doesn't scale and looks cramped. TextView automatically corrects the `lineHeight` so that your intended proportions are preserved, but only if both `textSize` and `lineHeight` are defined in sp units.

## Camera and media

### Ultra HDR for images

![](/static/images/about/versions/14/SDR-HDR-compare.png)

An illustration of Standard Dynamic Range (SDR) versus High Dynamic Range (HDR) image quality.

Android 14 adds support for High Dynamic Range (HDR) images that retain more of the information from the sensor when taking a photo, which enables vibrant colors and greater contrast. Android uses the [Ultra HDR format](/guide/topics/media/platform/hdr-image-format), which is fully backward compatible with JPEG images, allowing apps to seamlessly interoperate with HDR images, displaying them in Standard Dynamic Range (SDR) as needed.

Rendering these images in the UI in HDR is done automatically by the framework when your app opts in to using HDR UI for its Activity Window, either through [a manifest entry](/guide/topics/manifest/activity-element#colormode) or at runtime by [calling `Window.setColorMode()`](/media/grow/ultra-hdr/display#configure-window). You can also capture [compressed Ultra HDR still images](/reference/android/graphics/ImageFormat#JPEG_R) on supported devices. With more colors recovered from the sensor, editing in post can be more flexible. The [`Gainmap`](/reference/android/graphics/Gainmap) associated with Ultra HDR images can be used to render them using OpenGL or Vulkan.

### Zoom, Focus, Postview, and more in camera extensions

Android 14 upgrades and improves [camera extensions](/training/camera/camera-extensions), allowing apps to handle longer processing times, which enables improved images using compute-intensive algorithms like low-light photography on supported devices. These features give users an even more robust experience when using camera extension capabilities. Examples of these improvements include:

- Dynamic still capture processing latency estimation provides much more accurate still capture latency estimates based on the current scene and environment conditions. Call [`CameraExtensionSession.getRealtimeStillCaptureLatency()`](/reference/android/hardware/camera2/CameraExtensionSession#getRealtimeStillCaptureLatency%28%29) to get a [`StillCaptureLatency`](/reference/android/hardware/camera2/CameraExtensionSession.StillCaptureLatency) object that has two latency estimation methods. The [`getCaptureLatency()`](/reference/android/hardware/camera2/CameraExtensionSession.StillCaptureLatency#getCaptureLatency%28%29) method returns the estimated latency between [`onCaptureStarted`](/reference/android/hardware/camera2/CameraExtensionSession.ExtensionCaptureCallback#onCaptureStarted(android.hardware.camera2.CameraExtensionSession,%20android.hardware.camera2.CaptureRequest,%20long) and [`onCaptureProcessStarted()`](</reference/android/hardware/camera2/CameraExtensionSession.ExtensionCaptureCallback#onCaptureProcessStarted(android.hardware.camera2.CameraExtensionSession,%20android.hardware.camera2.CaptureRequest)>), and the [`getProcessingLatency()`](</reference/android/hardware/camera2/CameraExtensionSession.StillCaptureLatency#getProcessingLatency()>) method returns the estimated latency between `onCaptureProcessStarted()` and the final processed frame being available.
- Support for capture progress callbacks so that apps can display the current progress of long-running, still-capture processing operations. You can check if this feature is available with [`CameraExtensionCharacteristics.isCaptureProcessProgressAvailable`](</reference/android/hardware/camera2/CameraExtensionCharacteristics#isCaptureProcessProgressAvailable%28int%29)(>), and if it is, you implement the [`onCaptureProcessProgressed()`](/reference/android/hardware/camera2/CameraExtensionSession.ExtensionCaptureCallback#onCaptureProcessProgressed%28android.hardware.camera2.CameraExtensionSession,%20android.hardware.camera2.CaptureRequest,%20int%29) callback, which has the progress (from 0 to 100) passed in as a parameter.
- Extension specific metadata, such as [`CaptureRequest.EXTENSION_STRENGTH`](/reference/android/hardware/camera2/CaptureRequest#EXTENSION_STRENGTH) for dialing in the amount of an extension effect, such as the amount of background blur with [`EXTENSION_BOKEH`](/reference/android/hardware/camera2/CameraExtensionCharacteristics#EXTENSION_BOKEH).

- Postview Feature for Still Capture in camera extensions, which provides a less-processed image more quickly than the final image. If an extension has increased processing latency, a postview image could be provided as a placeholder to improve UX and switched out later for the final image. You can check if this feature is available with [`CameraExtensionCharacteristics.isPostviewAvailable`](</reference/android/hardware/camera2/CameraExtensionCharacteristics#isPostviewAvailable%28int%29)(>). Then you can pass an [`OutputConfiguration`](/reference/android/hardware/camera2/params/OutputConfiguration) to [`ExtensionSessionConfiguration.setPostviewOutputConfiguration`](</reference/android/hardware/camera2/params/ExtensionSessionConfiguration#setPostviewOutputConfiguration%28android.hardware.camera2.params.OutputConfiguration%29)(>).

- Support for [`SurfaceView`](/reference/android/view/SurfaceView) allowing for a more optimized and power-efficient preview render path.

- Support for tap to focus and zoom during extension usage.

### In-sensor zoom

When [`REQUEST_AVAILABLE_CAPABILITIES_STREAM_USE_CASE`](/reference/android/hardware/camera2/CameraMetadata#REQUEST_AVAILABLE_CAPABILITIES_STREAM_USE_CASE) in [`CameraCharacteristics`](/reference/android/hardware/camera2/CameraCharacteristics) contains [`SCALER_AVAILABLE_STREAM_USE_CASES_CROPPED_RAW`](/reference/android/hardware/camera2/CameraMetadata#SCALER_AVAILABLE_STREAM_USE_CASES_CROPPED_RAW), your app can use advanced sensor capabilities to give a cropped RAW stream the same pixels as the full field of view by using a [`CaptureRequest`](/reference/android/hardware/camera2/CaptureRequest) with a RAW target that has stream use case set to [`CameraMetadata.SCALER_AVAILABLE_STREAM_USE_CASES_CROPPED_RAW`](/reference/android/hardware/camera2/CameraMetadata#SCALER_AVAILABLE_STREAM_USE_CASES_CROPPED_RAW). By implementing the request override controls, the updated camera gives users zoom control even before other camera controls are ready.

### Lossless USB audio

Android 14 gains support for lossless audio formats for audiophile-level experiences over USB wired headsets. You can query a USB device for its preferred mixer attributes, register a listener for changes in preferred mixer attributes, and configure mixer attributes using the [`AudioMixerAttributes`](/reference/android/media/AudioMixerAttributes) class. This class represents the format, such as channel mask, sample rate, and behavior of the audio mixer. The class allows for [audio to be sent directly](/reference/android/media/AudioMixerAttributes#MIXER_BEHAVIOR_BIT_PERFECT), without mixing, volume adjustment, or processing effects.

## Developer productivity and tools

### Credential Manager

Android 14 adds [Credential Manager](/reference/android/credentials/package-summary) as a platform API, with additional support back to Android 4.4 (API level 19) devices through a [Jetpack Library](/training/sign-in/passkeys) using Google Play services. Credential Manager aims to make sign-in easier for users with APIs that retrieve and store credentials with user-configured credential providers. Credential Manager supports multiple sign-in methods, including username and password, passkeys, and federated sign-in solutions (such as Sign-in with Google) in a single API.

[Passkeys](/design/ui/mobile/guides/patterns/passkeys) provide many advantages. For example, passkeys are [built on industry standards](https://fidoalliance.org/passkeys/), can work across different operating systems and browser ecosystems, and can be used with both websites and apps.

For more information, see the [Credential Manager and passkeys documentation](/training/sign-in/passkeys) and the [blogpost about Credential Manager and passkeys](https://android-developers.googleblog.com/2023/07/credential-manager-beta-easy-secure-authentication-with-passkeys-on-android.html).

### Health Connect

Health Connect is an on-device repository for user health and fitness data. It allows users to share data between their favorite apps, with a single place to control what data they want to share with these apps.

On devices running Android versions prior to Android 14, Health Connect is available to download as an app on the Google Play store. Starting with Android 14, Health Connect is part of the platform and receives updates through Google Play system updates without requiring a separate download. With this, Health Connect can be updated frequently, and your apps can rely on Health Connect being available on devices running Android 14 or higher. Users can access Health Connect from the Settings in their device, with privacy controls integrated into the system settings.

![](/static/images/about/versions/14/health-connect-screen.png)

Users can get started using Health Connect without a separate app download on devices running Android 14 or higher.

![](/static/images/about/versions/14/health-connect-permissions.png)

Users can control which apps have access to their health and fitness data through system settings.

Health Connect includes several new features in Android 14, such as exercise routes, allowing users to share a route of their workout which can be visualized on a map. A route is defined as a list of locations saved within a window of time, and your app can insert routes into exercise sessions, tying them together. To ensure that users have complete control over this sensitive data, users must allow sharing individual routes with other apps.

For more information, see the [Health Connection documentation](/guide/health-and-fitness/health-connect) and the blogpost on [What's new in Android Health](https://android-developers.googleblog.com/2023/05/whats-new-in-android-health.html).

### OpenJDK 17 updates

Android 14 continues the work of refreshing Android's core libraries to align with the features in the latest OpenJDK LTS releases, including both library updates and Java 17 language support for app and platform developers.

The following features and improvements are included:

- Updated approximately 300 `java.base` classes to Java 17 support.
- [Text Blocks](https://openjdk.org/jeps/378), which introduce multi-line string literals to the Java programming language.
- [Pattern Matching for instanceof](https://openjdk.org/jeps/394), which allows an object to be treated as having a specific type in an `instanceof` without any additional variables.
- [Sealed classes](https://openjdk.org/jeps/409), which allow you restrict which classes and interfaces can extend or implement them.

Thanks to [Google Play system updates](https://android-developers.googleblog.com/2019/05/fresher-os-with-projects-treble-and-mainline.html) (Project Mainline), over 600 million devices are enabled to receive the latest Android Runtime (ART) updates that include these changes. This is part of our commitment to give apps a more consistent, secure environment across devices, and to deliver new features and capabilities to users independent of platform releases.

_Java and OpenJDK are trademarks or registered trademarks of Oracle and/or its affiliates._

### Improvements for app stores

Android 14 introduces several [`PackageInstaller`](/reference/android/content/pm/PackageInstaller) APIs that allow app stores to improve their user experience.

**Note:** If you develop a third-party app store, we would love to [hear your feedback](https://issuetracker.google.com/issues/new?component=192705), so give these APIs a try and let us know what you think!

#### Request install approval before downloading

Installing or updating an app might require [user approval](/reference/android/content/pm/PackageInstaller#STATUS_PENDING_USER_ACTION). For example, when an installer making use of the [`REQUEST_INSTALL_PACKAGES`](/reference/android/Manifest.permission#REQUEST_INSTALL_PACKAGES) permission attempts to install a new app. In prior Android versions, app stores can only request user approval _after_ APKs are written to the [install session](/reference/android/content/pm/PackageInstaller.Session) and the session is [committed](</reference/android/content/pm/PackageInstaller.Session#commit(android.content.IntentSender)>).

Starting with Android 14, the [`requestUserPreapproval()`](</reference/android/content/pm/PackageInstaller.Session#requestUserPreapproval(android.content.pm.PackageInstaller.PreapprovalDetails,%20android.content.IntentSender)>) method lets installers request user approval _before_ committing the install session. This improvement lets an app store defer downloading any APKs until after the installation has been approved by the user. Furthermore, once a user has approved installation, the app store can download and install the app in the background without interrupting the user.

#### Claim responsibility for future updates

The [`setRequestUpdateOwnership()`](</reference/android/content/pm/PackageInstaller.SessionParams#setRequestUpdateOwnership(boolean)>) method allows an installer to indicate to the system that it intends to be responsible for future updates to an app it is installing. This capability enables update ownership enforcement, meaning that only the [update owner](</reference/android/content/pm/InstallSourceInfo#getUpdateOwnerPackageName()>) is permitted to install automatic updates to the app. Update ownership enforcement helps to ensure that users receive updates only from the expected app store.

Any other installer, including those making use of the [`INSTALL_PACKAGES`](/reference/android/Manifest.permission#INSTALL_PACKAGES) permission, must receive explicit user approval in order to install an update. If a user decides to proceed with an update from another source, update ownership is lost.

#### Update apps at less-disruptive times

App stores typically want to avoid updating an app that is actively in use because this leads to the app's running processes being killed, which potentially interrupts what the user was doing.

Starting with Android 14, the [`InstallConstraints`](/reference/android/content/pm/PackageInstaller.InstallConstraints) API gives installers a way to ensure that their app updates happen at an opportune moment. For example, an app store can call the [`commitSessionAfterInstallConstraintsAreMet()`](</reference/android/content/pm/PackageInstaller#commitSessionAfterInstallConstraintsAreMet(int,%20android.content.IntentSender,%20android.content.pm.PackageInstaller.InstallConstraints,%20long)>) method to make sure that an update is only committed when the user is no longer interacting with the app in question.

#### Seamlessly install optional splits

With split APKs, features of an app can be delivered in separate APK files, rather than as a monolithic APK. Split APKs allow app stores to optimize the delivery of different app components. For example, app stores might optimize based on the properties of the target device. The [`PackageInstaller`](/reference/android/content/pm/PackageInstaller) API has supported splits since its introduction in API level 22.

In Android 14, the [`setDontKillApp()`](</reference/android/content/pm/PackageInstaller.SessionParams#setDontKillApp(boolean)>) method allows an installer to indicate that the app's running processes shouldn't be killed when new splits are installed. App stores can use this feature to seamlessly install new features of an app while the user is using the app.

**Note:** If you distribute your app on Google Play, consider using [Play Feature Delivery](/guide/playcore/feature-delivery) to allow certain features of your app to be delivered conditionally or downloaded on demand.

### App metadata bundles

Starting in Android 14, the Android package installer lets you [specify app metadata](/about/versions/14/features/app-metadata), such as data safety practices, to include on app store pages such as Google Play.

### Detect when users take device screenshots

To create a more standardized experience for detecting screenshots, Android 14 introduces a privacy-preserving [screenshot detection API](/about/versions/14/features/screenshot-detection). This API lets apps register callbacks on a per-activity basis. These callbacks are invoked, and the user is notified, when the user takes a screenshot while that activity is visible.

**Note:** The callback doesn't provide an image of the actual screenshot. It's up to your app to determine what appeared on the screen when the user took a screenshot.

## User experience

### Sharesheet custom actions and improved ranking

Android 14 updates the system sharesheet to support custom app actions and more informative preview results for users.

#### Add custom actions

With Android 14, your app can [add custom actions to the system sharesheet](/training/sharing/send#custom-actions) it invokes.

![](/static/images/training/sharing/sharesheet_custom_actions.png)

Screenshot of custom actions on the sharesheet.

#### Improve ranking of Direct Share targets

Android 14 uses more signals from apps to determine the ranking of [the direct share targets](/training/sharing/direct-share-targets) to provide more helpful results for the user. To provide the most useful signal for ranking, follow the guidance for [improving rankings of your Direct Share targets](/training/sharing/direct-share-targets#get-best-ranking). Communication apps can also [report shortcut usage](/training/sharing/direct-share-targets#track-shortcut-usage-comms-apps) for outgoing and incoming messages.

![](/static/training/sharing/direct-share-targets.png)

Direct Share row in the sharesheet, as shown by 1

### Support for built-in and custom animations for Predictive Back

Alas, your browser doesn't support HTML5 video. That's OK! You can still [download the video](/static/about/versions/14/images/predictive-back-settings-example.mp4) and watch it with a video player.

**Video:** Predictive back animations

Android 13 introduced the predictive back-to-home animation behind a developer option. When used in a supported app with the developer option enabled, swiping back shows an animation indicating that the back gesture exits the app back to the home screen.

Android 14 includes multiple improvements and new guidance for Predictive Back:

- You can set [`android:enableOnBackInvokedCallback=true`](/reference/android/R.attr#enableOnBackInvokedCallback) to opt in to predictive back system animations per-Activity instead of for the entire app.
- We've added new system animations to accompany the back-to-home animation from Android 13. The new system animations are cross-activity and cross-task, which you get automatically after [migrating to Predictive Back](/guide/navigation/predictive-back-gesture).
- We've added new Material Component animations for [Bottom sheets](https://m3.material.io/components/bottom-sheets/guidelines#3d7735e2-73ea-4f3e-bd42-e70161fc1085), [Side sheets](https://m3.material.io/components/side-sheets/guidelines#d77245e3-1013-48f8-a9d7-76f484e1be13), and [Search](https://m3.material.io/components/search/guidelines#3f2d4e47-2cf5-4c33-b6e1-5368ceaade55).
- We've created [design guidance](/design/ui/mobile/guides/patterns/predictive-back) for creating custom in-app animations and transitions.
- We've added new APIs to support custom in-app transition animations:
  - [`handleOnBackStarted`](</reference/androidx/activity/OnBackPressedCallback#handleOnBackStarted(android.window.BackEvent)>), [`handleOnBackProgressed`](</reference/androidx/activity/OnBackPressedCallback#handleOnBackProgressed(android.window.BackEvent)>), [`handleOnBackCancelled`](</reference/androidx/activity/OnBackPressedCallback#handleOnBackCancelled()>) `in` [`OnBackPressedCallback`](</reference/androidx/activity/OnBackPressedCallback#OnBackPressedCallback(kotlin.Boolean)>)
  - [`onBackStarted`](/reference/kotlin/android/window/OnBackAnimationCallback#onbackstarted), [`onBackProgressed`](/reference/kotlin/android/window/OnBackAnimationCallback#onbackprogressed), [`onBackCancelled`](/reference/kotlin/android/window/OnBackAnimationCallback#onbackcancelled) `in` [`OnBackAnimationCallback`](/reference/kotlin/android/window/OnBackAnimationCallback)
  - Use [`overrideActivityTransition`](</reference/android/app/Activity#overrideActivityTransition(int,%20int,%20int,%20int)>) instead of [`overridePendingTransition`](</reference/android/app/Activity#overridePendingTransition(int,%20int)>) for transitions that respond as the user swipes back.

With this Android 14 preview release, all features of Predictive Back remain behind a developer option. See the developer guide to [migrate your app to predictive back](/guide/navigation/predictive-back-gesture), as well as the [developer guide to creating custom in-app transitions](/about/versions/14/features/predictive-back).

### Large screen device manufacturer per-app overrides

Per-app overrides enable device manufacturers to change the behavior of apps on large screen devices. For example, the [`FORCE_RESIZE_APP`](/guide/topics/large-screens/large-screen-compatibility-mode#force_resize_app) override instructs the system to resize the app to fit display dimensions (avoiding size compatibility mode) even if [`resizeableActivity="false"`](/guide/topics/manifest/application-element#resizeableActivity) is set in the app manifest.

Overrides are intended to improve the user experience on large screens.

[New manifest properties](/about/versions/14/features/manufacturer-per-app-overrides) enable you to disable some device manufacturer overrides for your app.

### Large screen user per-app overrides

**Note:** This feature is included on devices running Android 14 QPR1 or higher.

Per-app overrides change the behavior of apps on large screen devices. For example, the [`OVERRIDE_MIN_ASPECT_RATIO_LARGE`](/guide/topics/large-screens/large-screen-compatibility-mode#override_min_aspect_ratio_large) device manufacturer override sets the app aspect ratio to 16:9 regardless of the app's configuration.

Android 14 QPR1 enables users to apply per‑app overrides by means of a [new settings menu](/about/versions/14/features/user-per-app-overrides) on large screen devices.

### App screen sharing

**Note:** This feature is included on devices running Android 14 QPR2 or higher.

App screen sharing enables users to share an app window instead of the entire device screen during screen content recording.

With app screen sharing, the status bar, navigation bar, notifications, and other system UI elements are excluded from the shared display. Only the content of the selected app is shared.

App screen sharing improves productivity and privacy by enabling users to run multiple apps but limit content sharing to a single app.

### LLM-powered Smart Reply in Gboard on Pixel 8 Pro

On Pixel 8 Pro devices with the December Feature Drop, developers can try out higher-quality smart replies in Gboard powered by on-device Large Language Models (LLMs) running on Google Tensor.

This feature is available as a limited preview for US English in WhatsApp, Line, and KakaoTalk. It requires using a Pixel 8 Pro device with Gboard as your keyboard.

To try it out, first enable the feature in **Settings > Developer Options > AiCore Settings > Enable Aicore Persistent**.

Next, open a conversation in a supported app to see LLM-powered Smart Reply in Gboard's suggestion strip in response to incoming messages.

Gboard utilizes on-device LLMs to provide higher-quality smart replies.

**Note:** This feature preview will begin rolling out to devices following the December Feature Drop. If you're not seeing the new Smart Reply behavior yet, please wait a couple days and try again. Model downloads might also take some time, so charging your device on Wi-Fi overnight can help speed this up.

## Graphics

### Paths are queryable and interpolatable

Android's [`Path`](/reference/android/graphics/Path) API is a powerful and flexible mechanism for creating and rendering vector graphics, with the ability to stroke or fill a path, construct a path from line segments or quadratic or cubic curves, perform boolean operations to get even more complex shapes, or all of these simultaneously. One limitation is the ability to find out what is actually in a Path object; the internals of the object are opaque to callers after creation.

To create a [`Path`](/reference/android/graphics/Path), you call methods such as [`moveTo()`](</reference/android/graphics/Path#moveTo(float,%20float)>), [`lineTo()`](</reference/android/graphics/Path#lineTo(float,%20float)>), and [`cubicTo()`](</reference/android/graphics/Path#cubicTo(float,%20float,%20float,%20float,%20float,%20float)>) to add path segments. But there has been no way to ask that path what the segments are, so you must retain that information at creation time.

Starting in Android 14, you can query paths to find out what's inside of them. First, you need to get a [`PathIterator`](/reference/android/graphics/PathIterator) object using the [`Path.getPathIterator`](</reference/android/graphics/Path#getPathIterator()>) API:

### Kotlin

val path \= Path().apply {
moveTo(1.0f, 1.0f)
lineTo(2.0f, 2.0f)
close()
}
val pathIterator \= path.pathIterator

### Java

Path path \= new Path();
path.moveTo(1.0F, 1.0F);
path.lineTo(2.0F, 2.0F);
path.close();
PathIterator pathIterator \= path.getPathIterator();

Next, you can call [`PathIterator`](/reference/android/graphics/PathIterator) to iterate through the segments one by one, retrieving all of the necessary data for each segment. This example uses [`PathIterator.Segment`](/reference/android/graphics/PathIterator.Segment) objects, which packages up the data for you:

### Kotlin

for (segment in pathIterator) {
println("segment: ${segment.verb}, ${segment.points}")
}

### Java

while (pathIterator.hasNext()) {
PathIterator.Segment segment \= pathIterator.next();
Log.i(LOG_TAG, "segment: " + segment.getVerb() + ", " + segment.getPoints());
}

`PathIterator` also has a non-allocating version of `next()` where you can pass in a buffer to hold the point data.

One of the important use cases of querying `Path` data is interpolation. For example, you might want to animate (or _morph_) between two different paths. To further simplify that use case, Android 14 also includes the [`interpolate()`](</reference/android/graphics/Path#interpolate(android.graphics.Path,%20float,%20android.graphics.Path)>) method on `Path`. Assuming the two paths have the same internal structure, the `interpolate()` method creates a new `Path` with that interpolated result. This example returns a path whose shape is halfway (a linear interpolation of .5) between `path` and `otherPath`:

### Kotlin

val interpolatedResult \= Path()
if (path.isInterpolatable(otherPath)) {
path.interpolate(otherPath, .5f, interpolatedResult)
}

### Java

Path interpolatedResult \= new Path();
if (path.isInterpolatable(otherPath)) {
path.interpolate(otherPath, 0.5F, interpolatedResult);
}

The Jetpack [graphics-path](/jetpack/androidx/releases/graphics#graphics-path) library enables similar APIs for earlier versions of Android as well.

### Custom meshes with vertex and fragment shaders

Android has long supported drawing triangle meshes with custom shading, but the input mesh format has been limited to a few predefined attribute combinations. Android 14 adds support for [custom meshes](/reference/kotlin/android/graphics/Mesh), which can be defined as [triangles](/reference/kotlin/android/graphics/Mesh?#TRIANGLES:kotlin.Int) or [triangle strips](/reference/kotlin/android/graphics/Mesh?#triangle_strip), and can, optionally, be indexed. These meshes are [specified](/reference/kotlin/android/graphics/MeshSpecification) with [custom attributes](/reference/kotlin/android/graphics/MeshSpecification.Attribute), vertex strides, [varying](/reference/kotlin/android/graphics/MeshSpecification.Varying), and vertex and fragment shaders written in [AGSL](/develop/ui/views/graphics/agsl).

The vertex shader defines the varyings, such as position and color, while the fragment shader can optionally define the color for the pixel, typically by using the varyings created by the vertex shader. If color is provided by the fragment shader, it is then blended with the current [`Paint`](/reference/android/graphics/Paint) color using the [blend mode](/reference/kotlin/android/graphics/BlendMode) selected when [drawing the mesh](/reference/android/graphics/Canvas#drawMesh%28android.graphics.Mesh,%20android.graphics.BlendMode,%20android.graphics.Paint%29). [Uniforms](/reference/android/graphics/Mesh#setFloatUniform%28java.lang.String,%20float%5B%5D%29) can be passed into the fragment and vertex shaders for additional flexibility.

### Hardware buffer renderer for Canvas

To assist in using Android's [`Canvas`](/reference/android/graphics/Canvas) API to draw with hardware acceleration into a [`HardwareBuffer`](/reference/android/hardware/HardwareBuffer), Android 14 introduces [`HardwareBufferRenderer`](/reference/android/graphics/HardwareBufferRenderer). This API is particularly useful when your use case involves communication with the system compositor through [`SurfaceControl`](/reference/android/view/SurfaceControl) for low-latency drawing.
