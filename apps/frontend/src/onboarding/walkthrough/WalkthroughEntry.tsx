import { Navigate } from "react-router";
import { walkthroughStartHref } from "./steps";

/** A shareable way back into the platform tour for anyone already signed in. */
const WalkthroughEntry = () => <Navigate to={walkthroughStartHref()} replace />;

export default WalkthroughEntry;
