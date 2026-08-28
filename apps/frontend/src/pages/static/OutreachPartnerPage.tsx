import { actionPartnershipsCreateResponse } from "@alliance/shared/client";
import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { cn } from "@alliance/shared/styles/util";
import { Check } from "lucide-react";
import React, { useState, type FormEvent } from "react";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { CONTACT_EMAIL } from "../../site/content";
import {
  BandHeading,
  BandLede,
  PageBand,
  PageShell,
} from "../../site/PageShell";
import {
  OUTREACH_CHANNELS,
  PARTNER_AUDIENCE_LABEL,
  PARTNER_CHANNELS_LABEL,
  PARTNER_FORM_BODY,
  PARTNER_FORM_TITLE,
  PARTNER_OFFERS_BODY,
  PARTNER_OFFERS_TITLE,
  PARTNER_RELY_TITLE,
  PARTNER_TASKS_BODY,
  PARTNER_TASKS_TITLE,
  PARTNER_TITLE,
  partnerOffers,
  partnerReliance,
  partnerTasks,
  partnerTrade,
  pastPartners,
  type PartnerTask,
} from "../../site/partnerContent";
import { LINK_BLUE, PANEL_GREEN } from "../../site/tokens";
import {
  SITE_INPUT,
  SITE_INPUT_STYLE,
  SITE_SUBMIT,
  SiteField,
  TexturedPanel,
} from "../../site/ui";

export function meta() {
  return socialPreviewMeta({
    title: "Outreach Partnerships",
    description:
      "Work with Alliance members who each commit 15 minutes every week to concrete actions for a better world.",
    url: "/outreach-partner",
  });
}

/**
 * The promise a mailing list can make, beside the one we can. The second box
 * carries the link-blue stroke, so the difference reads before the words do.
 */
function Reliance() {
  return (
    <PageBand className="flex flex-col gap-7 pb-8 lg:pb-10">
      <BandHeading>{PARTNER_RELY_TITLE}</BandHeading>
      <div className="grid gap-5 sm:grid-cols-2 sm:gap-8">
        {partnerReliance.map((pledge, index) => {
          const ours = index === partnerReliance.length - 1;
          return (
            <blockquote
              key={pledge.label}
              className={cn(
                "bg-white px-5 py-4 text-[1.05rem] leading-snug",
                ours
                  ? "border-2 border-[#1E68D9] font-medium text-[var(--site-ink)]"
                  : "border border-[var(--site-ink)]/20 text-[var(--site-ink)]/70",
              )}
              style={{ borderRadius: "var(--site-radius-card)" }}
            >
              {`“${pledge.quote}”`}
            </blockquote>
          );
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {partnerTrade.map((half) => (
          <article
            key={half.title}
            className="flex flex-col gap-2 border border-[var(--site-ink)]/15 bg-white p-6"
            style={{ borderRadius: "var(--site-radius-card)" }}
          >
            <h3 className="text-[1.15rem] font-medium text-[var(--site-primary)]">
              {half.title}
            </h3>
            <p className="text-[1rem] leading-snug text-[var(--site-ink)]/70">
              {half.body}
            </p>
          </article>
        ))}
      </div>
    </PageBand>
  );
}

/** One green panel holding the four things a partnership can be. */
function Offers() {
  return (
    <PageBand className="py-0">
      <TexturedPanel tint={PANEL_GREEN}>
        <div className="mb-8 flex flex-col gap-3">
          <h2 className="site-display text-[1.9rem] leading-tight text-white sm:text-[2.4rem]">
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
              style={{ borderRadius: "var(--site-radius-card)" }}
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
      </TexturedPanel>
    </PageBand>
  );
}

/** The task as members receive it, so the ask is concrete. */
function TaskMock({ task }: { task: PartnerTask }) {
  const percent = Math.round((task.done / task.total) * 100);

  return (
    <article
      className="flex flex-col gap-4 border border-[var(--site-ink)]/15 bg-white px-5 py-5"
      style={{ borderRadius: "var(--site-radius-card)" }}
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
        <h3 className="text-[1.05rem] leading-snug font-semibold text-[var(--site-ink)]">
          {task.title}
        </h3>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-[var(--site-ink)]/12">
          <div
            className="h-full rounded-full bg-[var(--site-primary)]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-[0.78rem] text-[var(--site-ink)]/55">
          {`${task.done}/${task.total} members completed the task`}
        </p>
      </div>

      <ul className="flex flex-col gap-1">
        {task.steps.map((step) => (
          <li
            key={step}
            className="flex items-start gap-2.5 rounded bg-[var(--site-ink)]/[0.06] px-2 py-1.5 text-[0.85rem] leading-snug text-[var(--site-ink)]"
          >
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary)] text-white">
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
        <BandLede>
          {"We have previously worked with organizations like "}
          {pastPartners.map((partner, index) => (
            <React.Fragment key={partner.name}>
              {index === 0
                ? ""
                : index === pastPartners.length - 1
                  ? ", and "
                  : ", "}
              <a
                href={partner.href}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-[var(--site-primary)]/35 underline-offset-2 hover:decoration-[var(--site-primary)]"
              >
                {partner.name}
              </a>
            </React.Fragment>
          ))}
          .
        </BandLede>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {partnerTasks.map((task) => (
          <TaskMock key={task.partner} task={task} />
        ))}
      </div>
    </PageBand>
  );
}

/** Flattened onto one screen, with the heading inside the card. */
function PartnerForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [otherOutreachSelected, setOtherOutreachSelected] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const outreachChannels = formData
      .getAll("outreachChannels")
      .map((value) => String(value));
    if (outreachChannels.length === 0) {
      setSubmitted(false);
      setOutreachError(
        "Select at least one way your organization could share.",
      );
      return;
    }

    setOutreachError(null);
    setSubmitError(null);
    setSubmitting(true);
    try {
      await actionPartnershipsCreateResponse({
        body: {
          organizationName: String(
            formData.get("organizationName") ?? "",
          ).trim(),
          organizationWebsite: String(
            formData.get("organizationWebsite") ?? "",
          ).trim(),
          personName: String(formData.get("personName") ?? "").trim(),
          contact: String(formData.get("contact") ?? "").trim(),
          outreachChannels,
          outreachOtherDetails: String(
            formData.get("outreachOtherDetails") ?? "",
          ).trim(),
          audienceSize: String(formData.get("audienceSize") ?? "").trim(),
          desiredCollaboration: String(
            formData.get("desiredCollaboration") ?? "",
          ).trim(),
          notes: String(formData.get("notes") ?? "").trim(),
        },
        throwOnError: true,
      });
      form.reset();
      setOtherOutreachSelected(false);
      setSubmitted(true);
    } catch (error) {
      console.error("Failed to submit action partnership form", error);
      setSubmitted(false);
      setSubmitError(
        `Something went wrong submitting this. Please try again or email ${CONTACT_EMAIL}.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageBand id="outreach-partner-form">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-6 bg-[var(--site-primary)] p-7 text-white sm:p-10"
        style={{ borderRadius: "var(--site-radius-card)" }}
      >
        <div className="flex flex-col gap-3">
          <h2 className="site-display text-[1.9rem] leading-tight text-white sm:text-[2.4rem]">
            {PARTNER_FORM_TITLE}
          </h2>
          <p className="max-w-[46rem] text-[1.08rem] leading-snug text-white/75 sm:text-[1.2rem]">
            {PARTNER_FORM_BODY}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <SiteField
            label="Organization name"
            name="organizationName"
            required
            onDark
          >
            <input
              id="organizationName"
              name="organizationName"
              type="text"
              required
              placeholder="Reforest Local"
              className={SITE_INPUT}
              style={SITE_INPUT_STYLE}
            />
          </SiteField>
          <SiteField
            label="Organization website"
            name="organizationWebsite"
            required
            onDark
          >
            <input
              id="organizationWebsite"
              name="organizationWebsite"
              type="url"
              required
              placeholder="https://example.org"
              className={SITE_INPUT}
              style={SITE_INPUT_STYLE}
            />
          </SiteField>
          <SiteField label="Your name" name="personName" required onDark>
            <input
              id="personName"
              name="personName"
              type="text"
              required
              autoComplete="name"
              className={SITE_INPUT}
              style={SITE_INPUT_STYLE}
            />
          </SiteField>
          <SiteField label="Email" name="contact" required onDark>
            <input
              id="contact"
              name="contact"
              type="email"
              required
              autoComplete="email"
              className={SITE_INPUT}
              style={SITE_INPUT_STYLE}
            />
          </SiteField>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <SiteField
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
              className={SITE_INPUT}
              style={SITE_INPUT_STYLE}
            />
          </SiteField>
          <SiteField
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
              className={cn(SITE_INPUT, "resize-y")}
              style={SITE_INPUT_STYLE}
            />
          </SiteField>
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-medium text-white/70">
            {PARTNER_CHANNELS_LABEL}
            <span className="text-white/50" aria-hidden>
              {" *"}
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {OUTREACH_CHANNELS.map((channel) => (
              <label
                key={channel}
                className="flex items-center gap-2 border border-white/25 px-3 py-2 text-sm text-white"
                style={SITE_INPUT_STYLE}
              >
                <input
                  type="checkbox"
                  name="outreachChannels"
                  value={channel}
                  className="size-4 accent-[#1E68D9]"
                  disabled={submitting}
                  onChange={(event) => {
                    if (channel === "Other") {
                      setOtherOutreachSelected(event.target.checked);
                    }
                    setOutreachError(null);
                    setSubmitted(false);
                    setSubmitError(null);
                  }}
                />
                {channel}
              </label>
            ))}
          </div>
          {otherOutreachSelected && (
            <SiteField
              label="What other way could you share?"
              name="outreachOtherDetails"
              required
              onDark
              className="mt-2"
            >
              <textarea
                id="outreachOtherDetails"
                name="outreachOtherDetails"
                required
                rows={3}
                maxLength={1000}
                placeholder="Briefly describe the other channel or context."
                className={cn(SITE_INPUT, "resize-y")}
                style={SITE_INPUT_STYLE}
              />
            </SiteField>
          )}
          {outreachError && (
            <p className="text-sm font-medium text-red-200" role="alert">
              {outreachError}
            </p>
          )}
        </fieldset>

        <SiteField label="Other notes" name="notes" onDark>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Anything else we should know?"
            className={cn(SITE_INPUT, "resize-y")}
            style={SITE_INPUT_STYLE}
          />
        </SiteField>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={submitting}
            className={cn(
              SITE_SUBMIT,
              "bg-white text-[var(--site-primary)] hover:bg-white/85",
            )}
            style={{ borderRadius: "var(--site-radius-button)" }}
          >
            {submitting ? "Sending…" : "Submit"}
          </button>
          {submitted && (
            <p className="text-[1rem] text-white">
              Thanks. We received your response and will follow up soon.
            </p>
          )}
          {submitError && (
            <p className="text-[1rem] text-red-200" role="alert">
              {submitError}
            </p>
          )}
        </div>
      </form>
    </PageBand>
  );
}

export default function OutreachPartnerPage() {
  const { data: memberCount } = useAllianceMemberCount();
  const lede = `Alliance members each spend 15 minutes a week taking actions on our online platform. For organizations working on our priorities, we can design a focused task in which ${
    memberCount
      ? `our ${memberCount.toLocaleString()} volunteer members`
      : "members"
  } help you.`;

  return (
    <PageShell title={PARTNER_TITLE} lede={lede} showJoinCta={false}>
      <Reliance />
      <Offers />
      <PartnerTasks />
      <PartnerForm />
    </PageShell>
  );
}
