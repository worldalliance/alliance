import { R } from "@alliance/common/result";
import { userVerifyEmail } from "@alliance/shared/client";
import { useEffect, useState } from "react";
import { Link, href, useSearchParams } from "react-router";

enum VerifyStatus {
  Verifying = "verifying",
  Verified = "verified",
  DeadLink = "dead_link",
  Failed = "failed",
}

const MESSAGES: Record<VerifyStatus, string> = {
  [VerifyStatus.Verifying]: "Verifying email...",
  [VerifyStatus.Verified]: "Your email has been verified.",
  [VerifyStatus.DeadLink]: "This verification link has expired or is invalid.",
  [VerifyStatus.Failed]:
    "We couldn't verify your email. Try opening the link again.",
};

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState(
    token ? VerifyStatus.Verifying : VerifyStatus.DeadLink,
  );

  useEffect(() => {
    if (token) {
      const verifyEmail = async () => {
        const resp = await R.fromPromise(userVerifyEmail({ body: { token } }));
        if (!resp.ok) {
          console.error(resp.error);
          setStatus(VerifyStatus.Failed);
        } else if (resp.value.response.ok) {
          setStatus(VerifyStatus.Verified);
        } else {
          console.error(resp.value.error);
          setStatus(
            resp.value.response.status === 400
              ? VerifyStatus.DeadLink
              : VerifyStatus.Failed,
          );
        }
      };
      verifyEmail();
    }
  }, [token]);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <p>{MESSAGES[status]}</p>
      <Link to={href("/tasks")} className="text-link">
        Go home
      </Link>
    </div>
  );
};

export default VerifyEmailPage;
