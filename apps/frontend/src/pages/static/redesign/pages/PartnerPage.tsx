import { cn } from "@alliance/shared/styles/util";
import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { RedesignPage } from "../links";
import {
  PARTNER_AUDIENCE_LABEL,
  PARTNER_CHANNELS,
  PARTNER_CHANNELS_LABEL,
  PARTNER_FORM_BODY,
  PARTNER_FORM_TITLE,
  PARTNER_LEDE,
  PARTNER_OFFERS_BODY,
  PARTNER_OFFERS_TITLE,
  PARTNER_RELY_TITLE,
  PARTNER_SUBMIT,
  PARTNER_SUBMITTED,
  PARTNER_TASKS_BODY,
  PARTNER_TASKS_TITLE,
  PARTNER_TITLE,
  partnerOffers,
  partnerReliance,
  partnerTasks,
  type PartnerTask,
} from "../pageContent";
import {
  BandHeading,
  BandLede,
  PageBand,
  PageShell,
} from "../sections/PageShell";
import { LINK_BLUE, PANEL_GREEN, type RedesignTheme } from "../theme";
import { RD_INPUT, RdField, RdTexturedPanel } from "../ui";

/**
 * The promise a mailing list can make, beside the one we can. The second box
 * carries the primary stroke, so the difference reads before the words do.
 */
function Reliance() {
  return (
    <div className="flex flex-col gap-7">
      <BandHeading>{PARTNER_RELY_TITLE}</BandHeading>
      <div className="grid gap-5 sm:grid-cols-2 sm:gap-8">
        {partnerReliance.map((pledge, index) => {
          const ours = index === partnerReliance.length - 1;
          return (
            <figure key={pledge.label} className="flex flex-col">
              <blockquote
                className={cn(
                  "bg-white px-5 py-4 text-[1.05rem] leading-snug",
                  ours
                    ? "border-2 border-[#1E68D9] font-medium text-[var(--rd-ink)]"
                    : "border border-[var(--rd-ink)]/20 text-[var(--rd-ink)]/70",
                )}
                style={{ borderRadius: "var(--rd-radius-card)" }}
              >
                {`“${pledge.quote}”`}
              </blockquote>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

function Trade() {
  return (
    <PageBand className="pb-8 lg:pb-10">
      <Reliance />
    </PageBand>
  );
}

/** One green panel holding the four things a partnership can be. */
function Offers() {
  return (
    <PageBand className="py-0">
      <RdTexturedPanel tint={PANEL_GREEN}>
        <div className="mb-8 flex flex-col gap-3">
          <h2 className="rd-headline text-[1.9rem] leading-tight text-white sm:text-[2.4rem]">
            {PARTNER_OFFERS_TITLE}
          </h2>
          <p className="max-w-[46rem] text-[1.08rem] leading-snug text-white/75 sm:text-[1.2rem]">
            {PARTNER_OFFERS_BODY}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {partnerOffers.map((offer) => (
            <article
              key={offer.title}
              className="flex flex-col gap-2 bg-white/10 p-6"
              style={{ borderRadius: "var(--rd-radius-card)" }}
            >
              <h3 className="text-[1.15rem] font-medium text-white">
                {offer.title}
              </h3>
              <p className="text-[1rem] leading-snug text-white/70">
                {offer.body}
              </p>
            </article>
          ))}
        </div>
      </RdTexturedPanel>
    </PageBand>
  );
}

/** The task as members receive it, so the ask is concrete. */
function TaskMock({ task }: { task: PartnerTask }) {
  const percent = Math.round((task.done / task.total) * 100);

  return (
    <article
      className="flex flex-col gap-4 border border-[var(--rd-ink)]/15 bg-white px-5 py-5"
      style={{ borderRadius: "var(--rd-radius-card)" }}
    >
      <div className="flex flex-col gap-1">
        <a
          href={task.href}
          target="_blank"
          rel="noreferrer"
          className="w-fit text-[0.8rem] font-medium tracking-[0.12em] uppercase hover:underline"
          style={{ color: LINK_BLUE }}
        >
          {task.partner}
        </a>
        <h3 className="text-[1.05rem] leading-snug font-semibold text-[var(--rd-ink)]">
          {task.title}
        </h3>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-[var(--rd-ink)]/12">
          <div
            className="h-full rounded-full bg-[var(--rd-accent)]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-[0.78rem] text-[var(--rd-ink)]/55">
          {`${task.done}/${task.total} members completed the task`}
        </p>
      </div>

      <ul className="flex flex-col gap-1">
        {task.steps.map((step) => (
          <li
            key={step}
            className="flex items-start gap-2.5 rounded bg-[var(--rd-ink)]/[0.06] px-2 py-1.5 text-[0.85rem] leading-snug text-[var(--rd-ink)]"
          >
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--rd-accent)] text-white">
              <Check className="size-2.5" strokeWidth={3.5} aria-hidden />
            </span>
            {step}
          </li>
        ))}
      </ul>
    </article>
  );
}

function PartnerTasks() {
  return (
    <PageBand className="flex flex-col gap-8 pt-12 lg:pt-16">
      <div className="flex flex-col gap-3">
        <BandHeading>{PARTNER_TASKS_TITLE}</BandHeading>
        <BandLede>{PARTNER_TASKS_BODY}</BandLede>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {partnerTasks.map((task) => (
          <TaskMock key={task.partner} task={task} />
        ))}
      </div>
    </PageBand>
  );
}

const inputStyle = { borderRadius: "var(--rd-radius-input)" };

/** Flattened onto one screen, with the heading inside the card. */
function PartnerForm() {
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <PageBand>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-6 bg-[var(--rd-primary)] p-7 text-white sm:p-10"
        style={{ borderRadius: "var(--rd-radius-card)" }}
      >
        <div className="flex flex-col gap-3">
          <h2 className="rd-headline text-[1.9rem] leading-tight text-white sm:text-[2.4rem]">
            {PARTNER_FORM_TITLE}
          </h2>
          <p className="max-w-[46rem] text-[1.08rem] leading-snug text-white/75 sm:text-[1.2rem]">
            {PARTNER_FORM_BODY}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-5">
            <RdField label="Organization" name="organizationName" required onDark>
              <input
                id="organizationName"
                name="organizationName"
                type="text"
                required
                className={RD_INPUT}
                style={inputStyle}
              />
            </RdField>
            <RdField label="Website" name="organizationWebsite" required onDark>
              <input
                id="organizationWebsite"
                name="organizationWebsite"
                type="url"
                required
                placeholder="https://example.org"
                className={RD_INPUT}
                style={inputStyle}
              />
            </RdField>
          </div>
          <div className="flex flex-col gap-5">
            <RdField label="Your name" name="personName" required onDark>
              <input
                id="personName"
                name="personName"
                type="text"
                required
                autoComplete="name"
                className={RD_INPUT}
                style={inputStyle}
              />
            </RdField>
            <RdField label="Email" name="contact" required onDark>
              <input
                id="contact"
                name="contact"
                type="email"
                required
                autoComplete="email"
                className={RD_INPUT}
                style={inputStyle}
              />
            </RdField>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <RdField
            label={PARTNER_AUDIENCE_LABEL}
            name="audienceSize"
            required
            onDark
          >
            <input
              id="audienceSize"
              name="audienceSize"
              type="text"
              required
              placeholder="Approximate size and where those people are"
              className={RD_INPUT}
              style={inputStyle}
            />
          </RdField>
          <RdField
            label="What would you like Alliance members to do?"
            name="desiredCollaboration"
            required
            onDark
          >
            <textarea
              id="desiredCollaboration"
              name="desiredCollaboration"
              required
              rows={3}
              placeholder="For example: learn about a cause, review a website, give campaign feedback, or help with a survey."
              className={cn(RD_INPUT, "resize-none")}
              style={inputStyle}
            />
          </RdField>
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-medium text-white/70">
            {PARTNER_CHANNELS_LABEL}
          </legend>
          <div className="flex flex-wrap gap-2">
            {PARTNER_CHANNELS.map((channel) => (
              <label
                key={channel}
                className="flex items-center gap-2 border border-white/25 px-3 py-2 text-sm text-white"
                style={inputStyle}
              >
                <input
                  type="checkbox"
                  name="outreachChannels"
                  value={channel}
                  className="size-4 accent-[#1E68D9]"
                />
                {channel}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="inline-flex min-h-12 items-center bg-white px-5 text-base font-medium text-[var(--rd-primary)] transition-colors hover:bg-white/85"
            style={{ borderRadius: "var(--rd-radius-button)" }}
          >
            {PARTNER_SUBMIT}
          </button>
          {submitted && <p className="text-[1rem] text-white">{PARTNER_SUBMITTED}</p>}
        </div>
      </form>
    </PageBand>
  );
}

export function RedesignPartnerPage({ theme }: { theme: RedesignTheme }) {
  return (
    <PageShell
      theme={theme}
      page={RedesignPage.Partner}
      title={PARTNER_TITLE}
      lede={PARTNER_LEDE}
      showJoinCta={false}
    >
      <Trade />
      <Offers />
      <PartnerTasks />
      <PartnerForm />
    </PageShell>
  );
}
