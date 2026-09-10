import { Redirect } from "expo-router";
import { walkthroughStart } from "../lib/onboarding/walkthroughSteps";

/** A shareable way back into the platform tour for anyone already signed in. */
const PlatformWalkthrough = () => <Redirect href={walkthroughStart()} />;

export default PlatformWalkthrough;
