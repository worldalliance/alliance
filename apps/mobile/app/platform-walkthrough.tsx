import { Redirect } from "expo-router";

/** The tour is off, so its shareable entry point just opens the platform. */
const PlatformWalkthrough = () => <Redirect href="/" />;

export default PlatformWalkthrough;
