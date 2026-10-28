import type { CohortExpression } from "@alliance/common/cohort-expression";
import type { UpdateActionFormVariantDto } from "@alliance/shared/client";
import type { ParsedActionFormVariantDto } from "@alliance/shared/parsed-dtos";
import { CardStyle } from "@alliance/shared/styles/card";
import { imageSrcFromKey } from "@alliance/sharedweb/lib/imageSrc";
import BaseButton, {
  BaseButtonVariant,
} from "@alliance/sharedweb/ui/BaseButton";
import Card from "@alliance/sharedweb/ui/Card";
import { ChevronDown, ChevronUp, SquarePen, Trash2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import { useBranchRoutingPreviewAdmin } from "../lib/useBranchRoutingPreviewAdmin";
import { type CoverImage, useCoverImage } from "../lib/useCoverImage";
import CohortExpressionBuilder from "./CohortExpressionBuilder";
import type { CohortLeafEditorSources } from "./CohortLeafEditors";

export type BranchFields = Required<
  Pick<
    UpdateActionFormVariantDto,
    | "name"
    | "nameOverride"
    | "shortDescriptionOverride"
    | "bodyOverride"
    | "timeEstimateOverride"
    | "squareThumbnailImageAltOverride"
    | "optional"
    | "optionalReason"
  >
> &
  Pick<
    UpdateActionFormVariantDto,
    "imageOverride" | "squareThumbnailImageOverride"
  > & { rule: CohortExpression };

const TEXT_OVERRIDES = [
  ["nameOverride", "Title"],
  ["shortDescriptionOverride", "Short description"],
  ["squareThumbnailImageAltOverride", "Square thumbnail alt text"],
] as const;

type Draft = {
  name: string;
  rule: CohortExpression | null;
  nameOverride: string;
  shortDescriptionOverride: string;
  bodyOverride: string;
  timeEstimateOverride: string;
  squareThumbnailImageAltOverride: string;
  optional: boolean;
  optionalReason: string;
};

const draftOf = (branch: ParsedActionFormVariantDto | null): Draft => ({
  name: branch?.name ?? "",
  rule: branch?.rule ?? null,
  nameOverride: branch?.nameOverride ?? "",
  shortDescriptionOverride: branch?.shortDescriptionOverride ?? "",
  bodyOverride: branch?.bodyOverride ?? "",
  timeEstimateOverride: branch?.timeEstimateOverride?.toString() ?? "",
  squareThumbnailImageAltOverride:
    branch?.squareThumbnailImageAltOverride ?? "",
  optional: branch?.optional ?? false,
  optionalReason: branch?.optionalReason ?? "",
});

const blankToNull = (value: string) => (value.trim() === "" ? null : value);

export default function ActionBranchEditor(props: {
  actionId: number;
  /** null for a branch not yet created. */
  branch: ParsedActionFormVariantDto | null;
  /** 1-based, in routing order. */
  position: number;
  /** The saved rules of the branches routed before this one. */
  earlierRules: readonly (CohortExpression | null)[];
  activeContractUserIds?: Set<number>;
  ruleError: boolean;
  sources: CohortLeafEditorSources;
  saving: boolean;
  onSave: (fields: BranchFields) => void;
  onDelete: () => void;
  onMove?: (direction: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const { branch, ruleError, sources, saving, onSave, onDelete, onMove } =
    props;
  const [draft, setDraft] = useState(() => draftOf(branch));
  const navigate = useNavigate();
  const nameId = useId();
  const image = useImageOverride(branch?.imageOverride ?? null);
  const thumbnail = useImageOverride(
    branch?.squareThumbnailImageOverride ?? null,
  );
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const routing = useBranchRoutingPreviewAdmin({
    actionId: props.actionId,
    rules: [...props.earlierRules, draft.rule],
  });
  const timeEstimate =
    draft.timeEstimateOverride.trim() === ""
      ? null
      : Number(draft.timeEstimateOverride);
  const invalid =
    draft.name.trim() === "" ||
    draft.rule === null ||
    ruleError ||
    (timeEstimate !== null &&
      (!Number.isInteger(timeEstimate) || timeEstimate < 0));
  const uploading = image.cover.uploading || thumbnail.cover.uploading;

  const save = () => {
    if (invalid || draft.rule === null) return;
    onSave({
      name: draft.name.trim(),
      rule: draft.rule,
      nameOverride: blankToNull(draft.nameOverride),
      shortDescriptionOverride: blankToNull(draft.shortDescriptionOverride),
      bodyOverride: blankToNull(draft.bodyOverride),
      timeEstimateOverride: timeEstimate,
      squareThumbnailImageAltOverride: blankToNull(
        draft.squareThumbnailImageAltOverride,
      ),
      imageOverride: image.saved(),
      squareThumbnailImageOverride: thumbnail.saved(),
      optional: draft.optional,
      optionalReason: draft.optional ? blankToNull(draft.optionalReason) : null,
    });
  };

  return (
    <Card
      style={CardStyle.White}
      className={`p-4 space-y-4 ${branch ? "" : "border-blue-200 bg-blue-50/40"}`}
    >
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <th className="text-left font-medium text-zinc-700 pr-4 py-1">
              Branch {props.position}
            </th>
            <td className="py-1">
              <div className="flex items-center gap-1">
                {onMove && (
                  <>
                    <button
                      type="button"
                      aria-label="Move branch down"
                      title="Move branch down"
                      disabled={!props.canMoveDown}
                      onClick={() => onMove(1)}
                      className="p-1 text-zinc-500 hover:text-zinc-900 disabled:opacity-30"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move branch up"
                      title="Move branch up"
                      disabled={!props.canMoveUp}
                      onClick={() => onMove(-1)}
                      className="p-1 text-zinc-500 hover:text-zinc-900 disabled:opacity-30"
                    >
                      <ChevronUp size={16} />
                    </button>
                  </>
                )}
                <div className="ml-auto">
                  <BaseButton
                    variant={BaseButtonVariant.RedOutline}
                    onClick={onDelete}
                    disabled={saving}
                  >
                    <span className="flex items-center gap-1">
                      <Trash2 size={14} />
                      {branch ? "Delete branch" : "Discard"}
                    </span>
                  </BaseButton>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <th className="text-left align-top font-medium text-zinc-700 pr-4 py-1 w-48">
              <label htmlFor={nameId}>Branch name</label>
              <p className="text-xs font-normal italic text-zinc-500 mt-1">
                A human readable description of the branch for staff only
              </p>
            </th>
            <td className="py-1">
              <textarea
                id={nameId}
                rows={2}
                className="w-96 border border-zinc-300 rounded-md px-2 py-1"
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </td>
          </tr>
          {branch && (
            <tr>
              <th className="text-left font-medium text-zinc-700 pr-4 py-1">
                Form
              </th>
              <td className="py-1">
                <BaseButton
                  variant={BaseButtonVariant.Outline}
                  iconLeft={SquarePen}
                  onClick={() => navigate(`/forms/${branch.formId}`)}
                >
                  Open in form builder
                </BaseButton>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div>
        <p className="text-sm font-medium text-zinc-700 mb-1">
          Members matching
        </p>
        {ruleError ? (
          <p className="text-xs text-red-600">
            The stored rule could not be parsed and is not shown. Saving is
            disabled so it isn&apos;t overwritten.
          </p>
        ) : (
          <CohortExpressionBuilder
            value={draft.rule}
            onChange={(rule) => set({ rule })}
            {...sources}
            activeContractUserIds={props.activeContractUserIds}
            routing={routing}
          />
        )}
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={draft.optional}
            onChange={(e) => set({ optional: e.target.checked })}
          />
          Optional for members on this branch
        </label>
        {draft.optional && (
          <>
            <p className="text-xs text-zinc-500">
              They get no notifications for this action, and skipping it never
              counts against them.
            </p>
            <TextField
              label="Why it's optional, shown to them (blank for a generic line)"
              value={draft.optionalReason}
              onChange={(value) => set({ optionalReason: value })}
            />
          </>
        )}
      </div>

      <details>
        <summary className="text-sm font-medium text-zinc-700 cursor-pointer">
          What members on this branch see
        </summary>
        <p className="text-xs text-zinc-500 my-2">
          Left blank, a field shows the action&apos;s own.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEXT_OVERRIDES.map(([field, label]) => (
            <TextField
              key={field}
              label={label}
              value={draft[field]}
              onChange={(value) => set({ [field]: value })}
            />
          ))}
          <TextField
            label="Time estimate (minutes)"
            type="number"
            value={draft.timeEstimateOverride}
            onChange={(value) => set({ timeEstimateOverride: value })}
          />
          <label className="sm:col-span-2 text-sm">
            <span className="block text-zinc-700 mb-1">Body (markdown)</span>
            <textarea
              rows={6}
              className="w-full border border-zinc-300 rounded-md px-2 py-1"
              value={draft.bodyOverride}
              onChange={(e) => set({ bodyOverride: e.target.value })}
            />
          </label>
          <ImageField label="Header image" field={image} />
          <ImageField label="Square thumbnail" field={thumbnail} />
        </div>
      </details>

      <div className="flex justify-end">
        <BaseButton
          variant={BaseButtonVariant.Blue}
          onClick={save}
          disabled={invalid || saving || uploading}
        >
          {saving ? "Saving…" : branch ? "Save branch" : "Create branch"}
        </BaseButton>
      </div>
    </Card>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="text-sm">
      <span className="block text-zinc-700 mb-1">{props.label}</span>
      <input
        type={props.type ?? "text"}
        min={props.type === "number" ? 0 : undefined}
        className="w-full border border-zinc-300 rounded-md px-2 py-1"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

type ImageOverride = {
  cover: CoverImage;
  cleared: boolean;
  clear: () => void;
  /** The value a save sends: a new upload, null to clear, undefined to keep. */
  saved: () => string | null | undefined;
};

function useImageOverride(stored: string | null): ImageOverride {
  const cover = useCoverImage();
  const [cleared, setCleared] = useState(false);
  const { reset } = cover;
  useEffect(() => {
    reset(stored ? imageSrcFromKey(stored) : null);
    setCleared(false);
  }, [reset, stored]);
  return {
    cover,
    cleared,
    clear: () => {
      cover.reset(null);
      setCleared(true);
    },
    saved: () => cover.key ?? (cleared ? null : undefined),
  };
}

function ImageField(props: { label: string; field: ImageOverride }) {
  const { cover, clear } = props.field;
  const inputId = useId();
  return (
    <div className="text-sm">
      <label htmlFor={inputId} className="block text-zinc-700 mb-1">
        {props.label}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void cover.pick(file);
        }}
        className="w-full text-sm"
      />
      {cover.uploading && <p className="text-blue-600 mt-1">Uploading…</p>}
      {cover.error && <p className="text-red-600 mt-1">{cover.error}</p>}
      {cover.preview && (
        <div className="relative mt-2 w-fit">
          <img
            src={cover.preview}
            alt=""
            className="max-h-32 rounded-md border border-zinc-300"
          />
          <button
            type="button"
            aria-label={`Remove the ${props.label.toLowerCase()} override`}
            title="Remove override"
            onClick={clear}
            className="absolute top-1 right-1 rounded-full bg-white/90 p-0.5 text-zinc-700"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
