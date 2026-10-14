// Background tasks must be defined when the bundle loads, so a headless
// launch for a push can find them.
import "expo-router/entry";
import "./lib/taskBadgeTask";
