import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import { useWaitlistTagsAdmin } from "../../lib/useWaitlistTagsAdmin";
import { emailDraftFromState, type EmailDraft } from "../../lib/waitlistEmail";
import { PlaceId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { Page } from "../../ui/templates/Page";
import { usePlaceTabs } from "../../ui/templates/usePlaceTabs";
import { EmailsTab } from "./EmailsTab";
import { EntriesTab } from "./EntriesTab";
import { ManageTagsDialog } from "./ManageTagsDialog";

const TABS = ["entries", "emails"] as const;
type Tab = (typeof TABS)[number];

const written = (draft: EmailDraft | null) =>
  draft !== null && (draft.subject.trim() !== "" || draft.body.trim() !== "");

export default function WaitlistPage() {
  const tabs = usePlaceTabs(PlaceId.Waitlist, TABS);
  const location = useLocation();
  const navigate = useNavigate();
  const confirm = useConfirmOnPage();
  const tags = useWaitlistTagsAdmin();
  // The draft lives here, so it survives a visit to the Emails tab.
  const [draft, setDraft] = useState<EmailDraft | null>(() =>
    emailDraftFromState(location.state),
  );
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const [showMetrics, setShowMetrics] = useState(false);
  const [managingTags, setManagingTags] = useState(false);
  useLeaveGuard(written(draft), { allowSamePath: true });

  // A draft passed by "Use again" opens the composer. Clearing it from the
  // history entry keeps Back or a reload from opening it again.
  useEffect(() => {
    const passed = emailDraftFromState(location.state);
    if (!passed) return;
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null },
    );
    const current = draftRef.current;
    const same =
      current?.subject === passed.subject && current.body === passed.body;
    if (same || !written(current)) {
      setDraft(passed);
      return;
    }
    void confirm({
      title: "Replace the email you're writing?",
      message: `Opens “${passed.subject}” in the composer in place of the subject and body you have written.`,
      confirmLabel: "Replace draft",
    }).then((ok) => ok && setDraft(passed));
  }, [location, navigate, confirm]);

  const actions: Record<Tab, ReactNode> = {
    entries: (
      <>
        <Button
          variant={ButtonVariant.Default}
          aria-pressed={showMetrics}
          onClick={() => setShowMetrics((shown) => !shown)}
        >
          Metrics
        </Button>
        <Button
          variant={ButtonVariant.Default}
          disabled={!tags.data}
          onClick={() => setManagingTags(true)}
        >
          Manage tags…
        </Button>
        <Button
          variant={draft ? ButtonVariant.Default : ButtonVariant.Primary}
          disabled={draft !== null}
          onClick={() => setDraft({ subject: "", body: "" })}
        >
          Compose email
        </Button>
      </>
    ),
    emails: null,
  };
  const body: Record<Tab, () => ReactNode> = {
    entries: () => (
      <EntriesTab
        draft={draft}
        onDraftChange={setDraft}
        onCloseComposer={() => setDraft(null)}
        showMetrics={showMetrics}
      />
    ),
    emails: () => <EmailsTab />,
  };

  return (
    <Page
      fill
      place={PlaceId.Waitlist}
      actions={actions[tabs.value]}
      tabs={tabs}
    >
      {body[tabs.value]()}
      {managingTags && tags.data && (
        <ManageTagsDialog
          tags={tags.data}
          onClose={() => setManagingTags(false)}
        />
      )}
    </Page>
  );
}
