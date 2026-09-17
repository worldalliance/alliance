import { MOBILE_OAUTH_RETURN_PATH } from "@alliance/common/oauth";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useLocation } from "react-router";
import { ANDROID_PACKAGE } from "../../lib/mobileApp";

// The page renders when the browser kept the redirect instead of handing it to
// the app. A plain link here would depend on the same App Link handling that
// just kept it, while an intent: link naming the package opens the app on a tap.
const MobileOAuthCallbackPage = () => {
  const { search } = useLocation();

  const returnToApp = () => {
    window.location.href = `intent://${window.location.host}${MOBILE_OAUTH_RETURN_PATH}${search}#Intent;scheme=https;package=${ANDROID_PACKAGE};end`;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 text-center text-xl my-12 flex flex-col items-center gap-6">
      {search ? (
        <>
          <p>Tap below to go back to the Alliance app.</p>
          <Button color={ButtonColor.Black} onClick={returnToApp}>
            Return to the app
          </Button>
          <p className="text-base">
            If that doesn&apos;t work, go back to the app and try again, or log
            in with your email and password.
          </p>
        </>
      ) : (
        <p>
          We couldn&apos;t finish signing you in to the Alliance app. Go back to
          the app and try again, or log in with your email and password.
        </p>
      )}
    </div>
  );
};

export default MobileOAuthCallbackPage;
