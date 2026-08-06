import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

const AllianceSignupPitch = ({ signupHref }: { signupHref: string }) => {
  return (
    <div className="rounded-2xl border border-green/20 bg-green/5 p-5 sm:p-6">
      <h3 className="text-xl font-semibold text-zinc-900 sm:text-2xl">
        The Alliance
      </h3>
      <p className="mt-3 text-sm font-normal text-zinc-700 sm:text-base sm:leading-7">
        We are a global community of people coordinating to address poverty,
        environmental destruction, democratic decline, and technological issues.{" "}
        <strong className="font-semibold">
          Members each commit 15 minutes a week
        </strong>{" "}
        to take actions like this one.
      </p>
      <p className="mt-3 text-sm font-normal text-zinc-700 sm:text-base sm:leading-7">
        For effectiveness, we plan actions based on the number of members we
        have. As more people join us, we can plan larger, more impactful
        actions.
      </p>
      <p className="mt-3 text-sm font-normal text-zinc-700 sm:text-base sm:leading-7">
        We&apos;re guided by an{" "}
        <a
          href="https://worldalliance.org/people#expert-group"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-green underline decoration-green/30 underline-offset-2 hover:decoration-green"
        >
          expert group
        </a>{" "}
        that includes former national environment secretaries, ex-UN officials,
        founders, and professors.
      </p>
      <Link
        to={signupHref}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-green px-6 py-3 text-base font-semibold text-white transition hover:opacity-90"
      >
        Join us
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
};

export default AllianceSignupPitch;
