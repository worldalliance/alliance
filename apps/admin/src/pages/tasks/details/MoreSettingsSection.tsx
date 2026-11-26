import type { CustomActionStat } from "@alliance/shared/client";
import { tracksCustomStat } from "@alliance/shared/lib/customActionStat";
import { ChevronRight } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "../../../ui/cn";
import { Input } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import { CheckboxField, Field, FormSection } from "../../../ui/templates/Form";
import type { DetailsSectionProps } from "./detailsRules";

const CUSTOM_STATS: Record<CustomActionStat, string> = {
  none: "None",
  users_invited: "Users invited",
};

/** Opens by itself once `inUse`, until the admin toggles it. */
export function SettingGroup({
  title,
  inUse,
  children,
}: {
  title: string;
  inUse: boolean;
  children: ReactNode;
}) {
  const [toggled, setToggled] = useState<boolean | null>(null);
  const [wasInUse, setWasInUse] = useState(inUse);
  if (inUse && !wasInUse) setWasInUse(true);
  const open = toggled ?? wasInUse;
  const contentId = useId();
  return (
    <div className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <h3 className="font-medium">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setToggled(!open)}
          className="flex items-center gap-1.5 rounded-sm focus-ring"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "size-4 text-fg-muted transition-transform duration-base",
              open && "rotate-90",
            )}
          />
          {title}
        </button>
      </h3>
      <div id={contentId} hidden={!open} className="flex flex-col gap-4 pt-3">
        {children}
      </div>
    </div>
  );
}

export function MoreSettingsSection({
  editor,
}: Pick<DetailsSectionProps, "editor">) {
  const { form } = editor;
  const forum = form.isForumParticipationAction ?? false;
  const stat = tracksCustomStat(form.customStatType);
  return (
    <FormSection
      title="More settings"
      description="Rarely used. A group opens by itself when it is in use."
    >
      <SettingGroup title="Forum participation" inUse={forum}>
        <CheckboxField
          name="isForumParticipationAction"
          label="Forum participation task"
          help="Completes the task for members who comment but don't press complete."
          checked={forum}
          onChange={editor.handleInputChange}
        />
        <Field
          label="Forum post ID (override)"
          help={
            forum
              ? "Completes on replies to this post, ignoring any forum validator on the form. Leave blank to use the form's validator."
              : "Applies once this is a forum participation task."
          }
        >
          {(control) => (
            <Input
              {...control}
              type="number"
              name="forumParticipationPostId"
              disabled={!forum}
              value={form.forumParticipationPostId ?? ""}
              onChange={editor.handleInputChange}
            />
          )}
        </Field>
        <CheckboxField
          name="forumParticipationIncludeChildren"
          label="Include child replies"
          help="Also counts replies to nested child posts of the override post."
          disabled={!forum}
          checked={form.forumParticipationIncludeChildren ?? false}
          onChange={editor.handleInputChange}
        />
      </SettingGroup>
      <SettingGroup title="Custom stat" inUse={stat}>
        <Field label="Custom stat type">
          {(control) => (
            <Select
              {...control}
              name="customStatType"
              value={form.customStatType ?? "none"}
              onChange={editor.handleInputChange}
            >
              {Object.entries(CUSTOM_STATS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Custom stat goal"
            help={stat ? undefined : "Applies once a stat type is picked."}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                name="customStatGoal"
                disabled={!stat}
                value={form.customStatGoal ?? ""}
                onChange={editor.handleInputChange}
              />
            )}
          </Field>
          <Field
            label="Custom stat label"
            help={stat ? undefined : "Applies once a stat type is picked."}
          >
            {(control) => (
              <Input
                {...control}
                name="customStatLabel"
                disabled={!stat}
                value={form.customStatLabel ?? ""}
                onChange={editor.handleInputChange}
              />
            )}
          </Field>
        </div>
      </SettingGroup>
    </FormSection>
  );
}
