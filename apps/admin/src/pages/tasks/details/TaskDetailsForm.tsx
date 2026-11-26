import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { Banner, BannerTone } from "../../../ui/templates/Banner";
import { SaveBar, useFocusFirstInvalid } from "../../../ui/templates/Form";
import type { TaskLookups } from "../taskTabs";
import { CompletionSection } from "./CompletionSection";
import { ContentSection } from "./ContentSection";
import {
  detailsSaveNote,
  detailsSaveState,
  type DetailsEditor,
} from "./detailsRules";
import { MoreSettingsSection } from "./MoreSettingsSection";
import { ParticipationSection } from "./ParticipationSection";
import { SetupSection } from "./SetupSection";
import { VisibilitySection } from "./VisibilitySection";

/**
 * A task's details as one explicitly saved form: the Details tab's body and
 * the whole of `/tasks/new`.
 */
export function TaskDetailsForm({
  editor,
  lookups,
  task,
  saving,
  cohortParseFailed = false,
  hideStaffPreview = false,
}: {
  editor: DetailsEditor;
  lookups: TaskLookups;
  /** The saved task; null on `/tasks/new`. */
  task: ParsedActionDto | null;
  saving: boolean;
  cohortParseFailed?: boolean;
  /** A task in a project takes staff preview from the project's staff testing. */
  hideStaffPreview?: boolean;
}) {
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const sections = { editor, lookups, task };
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        if (!editor.form.name.trim()) focusFirstInvalid();
        void editor.handleSubmit(e);
      }}
      className="flex flex-col gap-section"
    >
      {cohortParseFailed && (
        <Banner tone={BannerTone.Danger} inline>
          The stored cohort couldn't be read, so the cohort editor below is
          empty and saving is refused, since a save would erase it. Fix the
          stored data, then reload the page. The browser console has the
          details.
        </Banner>
      )}
      <ContentSection {...sections} />
      <SetupSection {...sections} />
      <ParticipationSection {...sections} />
      <VisibilitySection editor={editor} hideStaffPreview={hideStaffPreview} />
      <CompletionSection editor={editor} lookups={lookups} />
      <MoreSettingsSection editor={editor} />
      <div className="sticky bottom-0 z-10 overflow-hidden rounded-card border border-line">
        <SaveBar
          state={detailsSaveState({ saving, editor })}
          error={editor.saveError}
          note={detailsSaveNote(task, editor.form)}
          saveLabel={task ? "Save changes" : "Create task"}
          onDiscard={editor.discard}
        />
      </div>
      {editor.contentDialog}
    </form>
  );
}
