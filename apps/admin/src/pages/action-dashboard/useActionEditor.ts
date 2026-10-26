import type { CohortExpression } from "@alliance/common/cohort-expression";
import { R } from "@alliance/common/result";
import { ensureHttpProtocol } from "@alliance/common/url";
import { ActionCategory, CreateActionDto } from "@alliance/shared/client";
import type { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import React, { useCallback, useEffect, useState } from "react";
import type { ReviewerRow } from "../../components/ActionReviewersEditor";
import { actionFormInputValue } from "../../lib/actionFormInputValue";
import { changedActionImages } from "../../lib/actionImages";
import { makeTempId } from "../../lib/tempId";
import { useCoverImage } from "../../lib/useCoverImage";
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
    onboarding: false,
  };
}

export function useActionEditor(params: {
  admin: Pick<
    ReturnType<typeof useActionAdmin>,
    "action" | "isFetching" | "createAction" | "updateAction"
  >;
  actionId: number | null;
  isNew: boolean;
  cohortParseFailed: boolean;
  searchParams: URLSearchParams;
  setError: (error: string | null) => void;
}) {
  const {
    admin: { action, isFetching: actionFetching, createAction, updateAction },
    actionId,
    isNew,
    cohortParseFailed,
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

  useEffect(() => {
    if (isNew) {
      setForm(
        emptyActionDraft(
          searchParams.get("suiteId")
            ? parseInt(searchParams.get("suiteId")!)
            : undefined,
        ),
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
      }
    }
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
      ...formData
    } = parsedAction;

    const authors = parsedAction.authors ?? [];
    const authorIds = authors.map((user) => user.id);

    setForm({
      ...formData,
      taskFormId: parsedAction.taskFormId,
      suiteId: suite?.id,
      authorIds,
    });
    setReviewerRows(reviewers.map((r) => ({ ...r, key: makeTempId() })));

    setCohortExpression(parsedAction.cohortExpression ?? null);

    resetCoverImage(parsedAction.image ?? null);
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

    if (isNew) {
      const result = await R.fromPromise(
        createAction(formData),
        logActionError(),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      handleActionCreated(result.value);
    } else if (actionId) {
      // The mutation invalidates the action query, so fresh data is
      // refetched before this resolves.
      const result = await R.fromPromise(
        updateAction(formData),
        logActionError(),
      );
      if (!result.ok) setError(result.error);
    }
  };

  return {
    draftSeeded: seededActionId === actionId,
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
