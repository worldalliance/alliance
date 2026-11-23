import type { CohortExpression } from "@alliance/common/cohort-expression";
import { R } from "@alliance/common/result";
import { ensureHttpProtocol } from "@alliance/common/url";
import {
  ActionCategory,
  CreateActionDto,
  type ActionSuiteDto,
} from "@alliance/shared/client";
import type { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import { omit } from "es-toolkit";
import jsonStableStringify from "json-stable-stringify";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewerRow } from "../../components/ActionReviewersEditor";
import { useContentConfirm } from "../../components/useContentConfirm";
import { partsMaySetOptional } from "../../lib/actionFieldDefs";
import { actionFormInputValue } from "../../lib/actionFormInputValue";
import { changedActionImages } from "../../lib/actionImages";
import { makeTempId } from "../../lib/tempId";
import { useCoverImage } from "../../lib/useCoverImage";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import { imageUploadingMessage, logActionError } from "./actionSaveErrors";
import { useNavigateToCreatedAction } from "./useActionCommands";

export type ActionEditorState = ReturnType<typeof useActionEditor>;

function emptyActionDraft(suiteId: number | undefined): CreateActionDto {
  return {
    name: "",
    category: [],
    image: "",
    body: "",
    timeEstimate: 0,
    shortDescription: "",
    visibilityMode: "public",
    isContractSigningAction: false,
    preventCompletion: false,
    staffPreview: false,
    taskFormId: undefined,
    isForumParticipationAction: false,
    shouldCompleteAfterDeadline: false,
    publicOnly: false,
    suiteId,
    optional: false,
    authorIds: [],
    prerequisiteActionIds: [],
    onboarding: false,
  };
}

// Keys are sorted so a field patched into a saved draft that lacked it
// compares equal to the form. A blank field may be absent, null or ""
// depending on whether it was seeded, fetched or cleared, so all three
// compare equal.
const serializeDraft = (draft: object) =>
  jsonStableStringify(draft, {
    replacer: (_key, value) =>
      value === null || value === "" ? undefined : value,
  }) ?? "";

const draftOf = (input: {
  form: CreateActionDto;
  reviewerRows: ReviewerRow[];
  cohortExpression: CohortExpression | null;
  imageKey: string | null;
}) =>
  serializeDraft({
    ...input.form,
    reviewers: input.reviewerRows.map(({ key: _key, ...row }) => row),
    cohortExpression: input.cohortExpression,
    imageKey: input.imageKey,
  });

// `form` also holds the fetched action's read-only fields, such as authors'
// bios, so the save check covers only the fields edited here.
const AUTHORED_FIELDS: Record<keyof CreateActionDto, boolean> = {
  name: true,
  shortDescription: true,
  body: true,
  image: true,
  squareThumbnailImage: true,
  squareThumbnailImageAlt: true,
  customStatLabel: true,
  reviewers: true,
  cohortExpression: false,
  category: false,
  isContractSigningAction: false,
  visibilityMode: false,
  onboarding: false,
  optional: false,
  preventCompletion: false,
  publicOnly: false,
  shouldCompleteAfterDeadline: false,
  isForumParticipationAction: false,
  customStatType: false,
  timeEstimate: false,
  taskFormId: false,
  taskKind: false,
  forumParticipationPostId: false,
  forumParticipationIncludeChildren: false,
  computedAutocompleteAt: false,
  customStatGoal: false,
  suiteId: false,
  staffPreview: false,
  authorIds: false,
  prerequisiteActionIds: false,
  slug: false,
};

const AUTHORED_KEYS = new Set(
  Object.entries(AUTHORED_FIELDS).flatMap(([key, authored]) =>
    authored ? [key] : [],
  ),
);

export function useActionEditor(params: {
  admin: Pick<
    ReturnType<typeof useActionAdmin>,
    "action" | "isFetching" | "createAction" | "updateAction"
  >;
  actionId: number | null;
  isNew: boolean;
  cohortParseFailed: boolean;
  lookups: {
    availableSuites?: readonly Pick<ActionSuiteDto, "id" | "isPartitioned">[];
    suitesLoading: boolean;
    suitesError: boolean;
  };
  searchParams: URLSearchParams;
  setError: (error: string | null) => void;
}) {
  const {
    admin: { action, isFetching: actionFetching, createAction, updateAction },
    actionId,
    isNew,
    cohortParseFailed,
    lookups,
    searchParams,
    setError,
  } = params;
  // Which action id the draft state was last seeded from (see the seeding
  // effect below); null means the next loaded action should (re)seed. Kept as
  // state (not a ref) so `draftSeeded` covers the cached-data window where the
  // seed is still waiting out a background refetch.
  const [seededActionId, setSeededActionId] = useState<number | null>(null);
  const {
    key: imageKey,
    preview: imagePreview,
    error: imageError,
    uploading: imageUploading,
    pick: pickCoverImage,
    cancel: cancelCoverImage,
    reset: resetCoverImage,
  } = useCoverImage();
  const [cohortExpression, setCohortExpression] =
    useState<CohortExpression | null>(null);

  const [form, setForm] = useState<CreateActionDto>(() =>
    emptyActionDraft(undefined),
  );
  const [reviewerRows, setReviewerRows] = useState<ReviewerRow[]>([]);
  const [savedDraft, setSavedDraft] = useState<string | null>(null);
  const { confirmSave, dialog: contentDialog } = useContentConfirm();
  // A save can resolve after staff have moved on to another action, whose
  // draft it must leave alone.
  const currentActionId = useRef(actionId);
  useEffect(() => {
    currentActionId.current = actionId;
  }, [actionId]);

  useEffect(() => {
    if (isNew) {
      const emptyForm = emptyActionDraft(
        searchParams.get("suiteId")
          ? parseInt(searchParams.get("suiteId")!)
          : undefined,
      );
      setForm(emptyForm);
      setSavedDraft(
        draftOf({
          form: emptyForm,
          reviewerRows: [],
          cohortExpression: null,
          imageKey: null,
        }),
      );
      setReviewerRows([]);
      resetCoverImage(null);
      setError(null);
      setCohortExpression(null);
      setSeededActionId(null);
    }
  }, [isNew, searchParams, resetCoverImage, setError]);

  const setTaskFormId = async (formId: number) => {
    setForm((prev) => ({ ...prev, taskFormId: formId }));
    if (actionId) {
      const result = await R.fromPromise(updateAction({ taskFormId: formId }));
      if (!result.ok) {
        setError("Failed to update action form");
        console.error(result.error);
        return;
      }
      if (currentActionId.current !== actionId) return;
      setSavedDraft(
        (prev) =>
          prev && serializeDraft({ ...JSON.parse(prev), taskFormId: formId }),
      );
    }
  };

  const setStaffPreview = async (staffPreview: boolean) => {
    const result = await R.fromPromise(
      updateAction({ staffPreview }),
      logActionError(),
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (currentActionId.current !== actionId) return;
    setForm((prev) => ({ ...prev, staffPreview }));
    setSavedDraft(
      (prev) => prev && serializeDraft({ ...JSON.parse(prev), staffPreview }),
    );
  };

  // Seed the editable draft state (form fields, reviewers, cohort expression,
  // image) once per action; background refetches and cache writes must not
  // stomp in-progress edits. Wait out in-flight fetches so the seed comes
  // from fresh data, not a stale cache entry.
  useEffect(() => {
    const parsedAction = action;
    if (!parsedAction || actionFetching || seededActionId === parsedAction.id) {
      return;
    }
    setSeededActionId(parsedAction.id);

    const {
      usersCompleted: _usersCompleted,
      usersJoined: _usersJoined,
      events: _events,
      updates: _updates,
      suite,
      reviewers,
      followUpForms: _followUpForms,
      // Saved inline on its own; a stale copy here would undo that save.
      slug: _slug,
      ...formData
    } = parsedAction;

    const authors = parsedAction.authors ?? [];
    const authorIds = authors.map((user) => user.id);

    const seededForm = {
      ...formData,
      taskFormId: parsedAction.taskFormId,
      suiteId: suite?.id,
      authorIds,
    };
    const seededRows = reviewers.map((r) => ({ ...r, key: makeTempId() }));
    const seededCohort = parsedAction.cohortExpression ?? null;
    setForm(seededForm);
    setReviewerRows(seededRows);
    setCohortExpression(seededCohort);
    resetCoverImage(parsedAction.image ?? null);
    setSavedDraft(
      draftOf({
        form: seededForm,
        reviewerRows: seededRows,
        cohortExpression: seededCohort,
        imageKey: null,
      }),
    );
  }, [action, actionFetching, seededActionId, resetCoverImage]);

  const handleActionCreated = useNavigateToCreatedAction();

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;

    if (type === "checkbox") {
      setForm((prev) => ({
        ...prev,
        [name]: target.checked,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: actionFormInputValue(name, value),
    }));
  };

  const handleCohortExpressionChange = useCallback(
    (expr: CohortExpression | null) => {
      setCohortExpression(expr);
    },
    [],
  );

  const handlePrerequisitesChange = useCallback((ids: number[]) => {
    setForm((prev) => ({ ...prev, prerequisiteActionIds: ids }));
  }, []);

  const handleAuthorsChange = useCallback((ids: number[]) => {
    setForm((prev) => ({
      ...prev,
      authorIds: ids,
    }));
  }, []);

  const handleCategoryChange = useCallback((category: ActionCategory[]) => {
    setForm((prev) => ({ ...prev, category }));
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so re-picking the same file after a failure still fires a
    // change event.
    e.target.value = "";
    if (file) void pickCoverImage(file);
  };

  const dirty =
    seededActionId === actionId &&
    savedDraft !== null &&
    draftOf({ form, reviewerRows, cohortExpression, imageKey }) !== savedDraft;
  // A cover image still uploading is not in the draft yet. A new action's
  // draft resets when its search params change.
  const navigateUnprompted = useLeaveGuard(
    dirty || (imageUploading && seededActionId === actionId),
    { allowSamePath: !isNew },
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Saving would overwrite the stored (unparseable) cohort expression with
    // the empty editor state
    if (cohortParseFailed) {
      setError(
        "Saving is disabled: the stored cohort expression could not be parsed.",
      );
      return;
    }

    if (imageUploading) {
      setError(imageUploadingMessage);
      return;
    }

    const formData = {
      ...form,
      ...changedActionImages({ form, action, imageKey }),
      cohortExpression,
      reviewers: reviewerRows
        .map((r) => {
          const url = r.url?.trim();
          return {
            name: r.name.trim(),
            url: url ? ensureHttpProtocol(url) : undefined,
            icon: r.icon,
          };
        })
        .filter((r) => r.name),
    };
    const authored = Object.fromEntries(
      Object.entries(formData).filter(([key]) => AUTHORED_KEYS.has(key)),
    );
    // The other authored fields are plain text, images, or reviewer urls the
    // editor makes absolute, so only the body holds links a path can replace.
    if (!(await confirmSave(authored, { siteLinksIn: formData.body }))) return;

    if (isNew) {
      const result = await R.fromPromise(
        createAction(formData),
        logActionError(),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const created = result.value;
      if (currentActionId.current !== actionId) return;
      setSavedDraft(null);
      navigateUnprompted(() => handleActionCreated(created));
    } else if (actionId) {
      // The mutation invalidates the action query, so fresh data is
      // refetched before this resolves.
      const submitted = draftOf({
        form,
        reviewerRows,
        cohortExpression,
        imageKey,
      });
      // The grid sets the hidden flag, and may have changed it since load.
      const gridOptional = partsMaySetOptional(
        {
          suites: lookups.availableSuites ?? [],
          loading: lookups.suitesLoading,
          failed: lookups.suitesError,
        },
        form.suiteId,
      );
      const result = await R.fromPromise(
        updateAction(gridOptional ? omit(formData, ["optional"]) : formData),
        logActionError(),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (currentActionId.current !== actionId) return;
      if (!gridOptional) {
        setSavedDraft(submitted);
        return;
      }
      // Kept as stored, so a move out of the suite doesn't send a stale flag.
      const { optional } = result.value;
      setForm((prev) => ({ ...prev, optional }));
      setSavedDraft(
        draftOf({
          form: { ...form, optional },
          reviewerRows,
          cohortExpression,
          imageKey,
        }),
      );
    }
  };

  return {
    draftSeeded: seededActionId === actionId,
    dirty,
    setStaffPreview,
    contentDialog,
    form,
    reviewerRows,
    setReviewerRows,
    cohortExpression,
    imageKey,
    imagePreview,
    imageError,
    imageUploading,
    cancelCoverImage,
    setTaskFormId,
    handleInputChange,
    handleCohortExpressionChange,
    handlePrerequisitesChange,
    handleAuthorsChange,
    handleCategoryChange,
    handleImageChange,
    handleSubmit,
  };
}
