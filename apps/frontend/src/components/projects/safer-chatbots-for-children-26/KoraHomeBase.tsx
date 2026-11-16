import { KORA_EXAMPLE_PATH, KORA_REVIEW_PATH } from "@alliance/common/kora";
import type { KoraHomeDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CONTACT_EMAIL } from "../../../site/content";
import { DisplayHeading } from "../../../site/ui";
import { AboutSections } from "./AboutSections";
import { HOME_COPY } from "./copy";
import { type Hero, HeroAction, heroOf, showBatchTable } from "./koraHomeHero";
import { KoraUserBatches } from "./KoraUserBatches";
import { useKoraHome, useKoraReview } from "./useKoraReview";

export const EXAMPLE_OPENED_KEY = "kora.exampleOpened";

function useExampleOpened(): boolean {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    setOpened(localStorage.getItem(EXAMPLE_OPENED_KEY) === "true");
  }, []);
  return opened;
}

function HeroSection({
  hero,
  totalRanked,
  start,
  starting,
  startFailed,
}: {
  hero: Hero;
  totalRanked: number;
  start: () => void;
  starting: boolean;
  startFailed: boolean;
}) {
  const action = hero.action;
  return (
    <section className="flex flex-col items-start gap-4">
      <DisplayHeading as="h1" className="text-4xl sm:text-5xl">
        {hero.heading}
      </DisplayHeading>
      {totalRanked > 0 && (
        <p className="text-lg text-zinc-700">
          {HOME_COPY.rankedSoFar(totalRanked)}
        </p>
      )}
      {hero.note && <p className="text-lg text-zinc-700">{hero.note}</p>}
      {action?.kind === HeroAction.Continue && (
        <Button to={KORA_REVIEW_PATH} color={ButtonColor.Black}>
          {action.label}
        </Button>
      )}
      {action?.kind === HeroAction.Start && (
        <Button color={ButtonColor.Black} disabled={starting} onClick={start}>
          {action.label}
        </Button>
      )}
      {startFailed && (
        <p role="alert" className="text-red-700">
          {HOME_COPY.startFailed}
        </p>
      )}
    </section>
  );
}

function ExampleCard() {
  return (
    <section
      aria-labelledby="kora-example"
      className="flex flex-col items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-6"
    >
      <h2 id="kora-example" className="text-xl font-medium">
        {HOME_COPY.exampleHeading}
      </h2>
      <p className="text-zinc-700">{HOME_COPY.exampleBody}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button to={KORA_EXAMPLE_PATH} color={ButtonColor.White}>
          {HOME_COPY.exampleButton}
        </Button>
        <span className="text-sm text-zinc-500">{HOME_COPY.exampleTime}</span>
      </div>
    </section>
  );
}

function Questions() {
  return (
    <footer className="flex flex-col gap-4 border-t border-zinc-200 pt-6 text-zinc-700">
      <p>
        {HOME_COPY.questions}{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
          {HOME_COPY.contact}
        </a>
      </p>
      <details>
        <summary className="cursor-pointer underline">
          {HOME_COPY.about}
        </summary>
        <AboutSections className="mt-8" />
      </details>
    </footer>
  );
}

export function KoraHomeView({
  home,
  now,
  exampleOpened,
  start,
  starting,
  startFailed,
}: {
  home: KoraHomeDto;
  now: Date;
  exampleOpened: boolean;
  start: () => void;
  starting: boolean;
  startFailed: boolean;
}) {
  const newcomer = home.totalRanked === 0 && !exampleOpened;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <HeroSection
        hero={heroOf(home, now)}
        totalRanked={home.totalRanked}
        start={start}
        starting={starting}
        startFailed={startFailed}
      />
      {newcomer && <ExampleCard />}
      {showBatchTable(home) && (
        <KoraUserBatches
          batches={home.userBatches}
          start={start}
          starting={starting}
        />
      )}
      {!newcomer && (
        <Link to={KORA_EXAMPLE_PATH} className="self-start underline">
          {exampleOpened ? HOME_COPY.exampleAgain : HOME_COPY.exampleLink}
        </Link>
      )}
      <Questions />
    </div>
  );
}

export function KoraHomeBase() {
  const home = useKoraHome();
  const { more } = useKoraReview(false);
  const navigate = useNavigate();
  const exampleOpened = useExampleOpened();
  const start = () =>
    more.mutate(undefined, {
      onSuccess: () => void navigate(KORA_REVIEW_PATH),
    });

  if (home.isPending) return <div aria-busy className="min-h-64" />;
  if (home.isError) {
    return (
      <p role="alert" className="text-red-700">
        {HOME_COPY.loadFailed}
      </p>
    );
  }
  return (
    <KoraHomeView
      home={home.data}
      now={new Date()}
      exampleOpened={exampleOpened}
      start={start}
      starting={more.isPending}
      startFailed={more.isError}
    />
  );
}
