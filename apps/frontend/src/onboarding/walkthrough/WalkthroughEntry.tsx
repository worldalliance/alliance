import { Navigate } from "react-router";
import { walkthroughStartHref } from "./steps";

/** A shareable link that points anyone already signed in at their first task. */
const WalkthroughEntry = () => <Navigate to={walkthroughStartHref()} replace />;

export default WalkthroughEntry;
