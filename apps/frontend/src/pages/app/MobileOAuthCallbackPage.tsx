// Opening the app from here only cancels the sign-in, so the page doesn't
// offer it.
const MobileOAuthCallbackPage = () => {
  return (
    <div className="max-w-2xl mx-auto px-4 text-center text-xl my-12">
      We couldn&apos;t finish signing you in to the Alliance app. Go back to the
      app and try again, or log in with your email and password.
    </div>
  );
};

export default MobileOAuthCallbackPage;
