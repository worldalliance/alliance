import {
  KORA_EXAMPLE_PATH,
  KORA_PROJECT_PATH,
  KORA_REVIEW_PATH,
} from "@alliance/common/kora";
import { EXAMPLE_PAIR } from "@alliance/kora-review/example-pair";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { NAV_HEIGHT } from "../../../site/Navbar";
import { SiteRoot } from "../../../site/PageShell";
import { SITE_COL } from "../../../site/ui";
import { EXAMPLE_COPY, HOME_COPY } from "./copy";
import { EXAMPLE_OPENED_KEY } from "./KoraHomeBase";
import { KoraNavbar } from "./KoraNavbar";
import { type KoraToolOptions, KoraReviewTool } from "./KoraReviewTool";

export function meta() {
  return socialPreviewMeta({
    title: "Example pair — Safer Chatbots for Children",
    description: "Practise ranking a made-up pair of chatbot conversations.",
    url: KORA_EXAMPLE_PATH,
  });
}

// The tool requires a hash's shape and only echoes it back; nothing is saved to check it against.
const EXAMPLE_HASH = `sha256:${"0".repeat(64)}`;

const OPTIONS: KoraToolOptions = {
  reviewerId: "example",
  assignment: {
    batchId: "example",
    transcripts: [
      {
        transcript: EXAMPLE_PAIR,
        contentHash: EXAMPLE_HASH,
      },
    ],
  },
  savedExport: null,
  collectProfile: false,
  collectExitSurvey: false,
  save: () => Promise.resolve(),
};

export default function KoraExamplePage() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    localStorage.setItem(EXAMPLE_OPENED_KEY, "true");
  }, []);
  return (
    <SiteRoot className="flex flex-col bg-white">
      <KoraNavbar hideNavLinks />
      <main className="flex-1" style={{ paddingTop: NAV_HEIGHT }}>
        <div
          className="sticky z-30 flex flex-wrap items-center justify-between gap-3 bg-yellow-100 px-5 py-3 text-zinc-900"
          style={{ top: NAV_HEIGHT }}
        >
          <p className="font-medium">{EXAMPLE_COPY.banner}</p>
          <Link to={KORA_PROJECT_PATH} className="min-h-6 underline">
            {EXAMPLE_COPY.back}
          </Link>
        </div>
        {done ? (
          <section
            aria-labelledby="kora-example-done"
            className={cn(SITE_COL, "flex max-w-2xl flex-col gap-6 py-12")}
          >
            <h1
              id="kora-example-done"
              className="site-display text-4xl font-medium"
            >
              {EXAMPLE_COPY.doneHeading}
            </h1>
            <Button
              to={KORA_REVIEW_PATH}
              color={ButtonColor.Black}
              className="self-start"
            >
              {HOME_COPY.startRanking}
            </Button>
          </section>
        ) : (
          <KoraReviewTool options={OPTIONS} onComplete={() => setDone(true)} />
        )}
      </main>
    </SiteRoot>
  );
}
