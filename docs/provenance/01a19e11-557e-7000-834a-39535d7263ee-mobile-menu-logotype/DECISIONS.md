## Decisions

- **The web's font file, converted.** The web wordmark is `font-logotype`: Libre Caslon Text Bold, title case, 0.02em tracking. Mobile bundles `assets/fonts/LibreCaslonText-Bold.ttf`, converted with fontTools from the web's `LibreCaslonText-Bold.woff2`, so both draw the same glyphs. That file is the web's Latin subset, enough for the wordmark, which is all it's used for (`FontFamily.Logotype`). The old Berlingske wordmark font had no other use and is removed.
- **Native builds embed it on the next build.** `app.config.js` embeds the font through `expo-font`, which takes effect in a new native build; until then `useFonts` loads it at runtime.
