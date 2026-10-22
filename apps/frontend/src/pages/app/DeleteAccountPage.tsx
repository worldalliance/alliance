import { errorMessage } from "@alliance/common/errorMessage";
// eslint-disable-next-line api-client/named-hooks-only -- one-off request whose result no query cache holds
import { userRequestAccountDeletion } from "@alliance/shared/client";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import Button from "@alliance/sharedweb/ui/NewButton";
import { useState } from "react";

const DeleteAccountPage = () => {
  const handleDeleteAccount = async () => {
    const resp = await userRequestAccountDeletion();

    if (resp.response.ok) {
      setConfirmed(true);
    } else {
      setError(
        errorMessage({
          error: resp.error,
          fallback: "Failed to request account deletion",
        }),
      );
    }
  };

  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <CenterLayout>
      <h1 className="text-title mb-4">Delete Account</h1>
      <p className="text-zinc-500 mb-4">
        If you would like your account information to be deleted, press the
        button below.
      </p>
      <Button onClick={handleDeleteAccount} disabled={confirmed}>
        Request Account Deletion
      </Button>
      {confirmed && (
        <p className="text-green font-medium mb-4">
          Your account deletion request has been sent. We will delete your
          account information within 7 days.
        </p>
      )}
      {error && <p className="text-red-500 font-medium mb-4">{error}</p>}
    </CenterLayout>
  );
};

export default DeleteAccountPage;
