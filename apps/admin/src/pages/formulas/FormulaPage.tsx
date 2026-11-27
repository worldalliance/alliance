import type { FormulaDto } from "@alliance/shared/client";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import FormulaFields from "../../components/formulas/FormulaFields";
import FormulaFixes from "../../components/formulas/FormulaFixes";
import FormulaHistory from "../../components/formulas/FormulaHistory";
import SaveRefusal from "../../components/formulas/SaveRefusal";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { refetchFresh } from "../../lib/refetchFresh";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useFormulasAdmin } from "../../lib/useFormulasAdmin";
import { RecordId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Skeleton } from "../../ui/Skeleton";
import { linkClass } from "../../ui/styles";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { FormSection, SaveBar } from "../../ui/templates/Form";
import { Page, PageBody } from "../../ui/templates/Page";
import { RecordBody, SidePanelSection } from "../../ui/templates/Record";
import {
  ContentState,
  FormSkeleton,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import {
  canExist,
  deleteMessage,
  formulaPath,
  FORMULAS_HREF,
  NEW,
} from "./formulaRules";
import {
  type FormulaEditor,
  type FormulaEditorParams,
  useFormulaEditor,
} from "./useFormulaEditor";

export default function FormulaPage() {
  const { formulaId = NEW } = useParams();
  /** Set by a save, so the remounted editor's Save button takes back focus. */
  const focusSave = useRef(false);
  const takeFocus = useCallback(() => {
    const taking = focusSave.current;
    focusSave.current = false;
    return taking;
  }, []);
  return (
    <LoadedFormula
      // A link to another formula keeps this route mounted; the key makes it
      // fetch the list afresh for each formula opened.
      key={formulaId}
      formulaId={formulaId}
      takeFocus={takeFocus}
      requestFocus={() => {
        focusSave.current = true;
      }}
    />
  );
}

function LoadedFormula({
  formulaId,
  takeFocus,
  requestFocus,
}: {
  formulaId: string;
  takeFocus: () => boolean;
  requestFocus: () => void;
}) {
  const possible = canExist(formulaId);
  const formulas = useFormulasAdmin({ enabled: possible });
  const [saves, setSaves] = useState(0);
  // The editor freezes the list it opens with, so it opens only once its own
  // fetch succeeds, not on a cached list; once open, a failed refetch keeps it.
  // Whether the formula is listed is settled each time the editor mounts, so a
  // refetch without it never drops the admin's edits, but a remount onto it
  // shows it missing.
  const [opened, setOpened] = useState<{
    missing: boolean;
    saves: number;
  } | null>(null);
  const listed = formulas.data?.find((formula) => formula.id === formulaId);
  const ready =
    opened === null
      ? formulas.isSuccess && formulas.isFetchedAfterMount
      : formulas.data !== undefined;
  if (ready && opened?.saves !== saves) {
    setOpened({ missing: formulaId !== NEW && listed === undefined, saves });
  }
  const notFound = !possible || opened?.missing === true;
  if (opened !== null && formulas.data !== undefined && !notFound) {
    return (
      <Editor
        // Only the editor's own save or Discard remounts it, so a refetch bringing
        // someone else's version keeps the admin's edits, and their save gets a 409.
        key={saves}
        formulaId={formulaId}
        formulas={formulas.data}
        refresh={() => refetchFresh(formulas.refetch)}
        takeFocus={takeFocus}
        requestFocus={requestFocus}
        remount={() => setSaves((count) => count + 1)}
        listQuery={formulas}
      />
    );
  }
  return (
    <Page
      record={RecordId.Formula}
      title={formulaId === NEW ? "New formula" : listed?.name}
      description=""
    >
      <LoadingBody record={formulaId !== NEW && !notFound && !formulas.isError}>
        <ContentState
          loading={!notFound && !formulas.isError}
          skeleton={<FormSkeleton fields={3} />}
          error={
            formulas.isError && !notFound
              ? adminRefusalMessage(formulas.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load this formula"
          onRetry={() => void formulas.refetch()}
          retrying={formulas.isFetching}
          empty={notFound}
          emptyTitle="Formula not found"
          emptyDescription="It may have been deleted. Check the link, or find it in the list."
          emptyAction={
            <Button variant={ButtonVariant.Default} to={FORMULAS_HREF}>
              All formulas
            </Button>
          }
        >
          {null}
        </ContentState>
      </LoadingBody>
    </Page>
  );
}

/** While an existing formula loads, its skeleton sits where the loaded form will. */
function LoadingBody({
  record,
  children,
}: {
  record: boolean;
  children: ReactNode;
}) {
  return record ? (
    <RecordBody side={<Skeleton className="h-24 w-full rounded-card" />}>
      {children}
    </RecordBody>
  ) : (
    <PageBody width="form">{children}</PageBody>
  );
}

function Editor({
  listQuery,
  ...params
}: FormulaEditorParams & { listQuery: ReturnType<typeof useFormulasAdmin> }) {
  const editor = useFormulaEditor(params);
  const confirm = useConfirmOnPage();
  const { stored } = editor;

  const askDelete = async () => {
    if (editor.busy || stored === undefined) return;
    const yes = await confirm({
      title: `Delete the formula “${stored.name}”?`,
      message: deleteMessage(editor.readers.length),
      confirmLabel: "Delete formula",
      destructive: true,
    });
    if (yes) editor.remove();
  };

  const form = <FormulaForm editor={editor} />;
  return (
    <Page
      record={RecordId.Formula}
      title={stored?.name ?? "New formula"}
      description={
        stored === undefined
          ? "Name a condition or value once, so other formulas and suite partitions can read it."
          : `Last saved ${formatDateTime(stored.updatedAt)}`
      }
      actions={
        stored !== undefined && (
          <Button
            variant={ButtonVariant.DangerOutline}
            busy={editor.deleting}
            disabled={editor.busy && !editor.deleting}
            onClick={() => void askDelete()}
          >
            Delete formula
          </Button>
        )
      }
      banner={
        // The refusal's Reload is the way back, so a second alert would only repeat it.
        !editor.refusal?.outdated && (
          <RefreshFailedBanner things="formulas" query={listQuery} />
        )
      }
    >
      {stored === undefined ? (
        <PageBody width="form">{form}</PageBody>
      ) : (
        <RecordBody
          side={
            <>
              <SidePanelSection title="Uses">
                <FormulaLinks
                  formulas={editor.reads}
                  empty="No other formulas."
                />
              </SidePanelSection>
              <SidePanelSection title="Used by">
                <FormulaLinks
                  formulas={editor.readers}
                  empty="Nothing reads this formula yet."
                />
              </SidePanelSection>
            </>
          }
        >
          {form}
          <FormulaHistory formula={stored} />
        </RecordBody>
      )}
    </Page>
  );
}

function FormulaForm({ editor }: { editor: FormulaEditor }) {
  return (
    <form
      ref={editor.formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        editor.save();
      }}
    >
      <FormSection
        title="Details"
        footer={
          <SaveBar
            state={editor.saveState}
            error={editor.saveError}
            stateText={editor.saveStateText}
            saveLabel={editor.isNew ? "Create formula" : "Save changes"}
            onDiscard={editor.discard}
          />
        }
      >
        <SaveRefusal refusal={editor.refusal} onReload={editor.reload} />
        {editor.problems.length > 0 && (
          <Banner inline tone={BannerTone.Danger}>
            {editor.refusedDelete
              ? "Nothing was deleted. Fix the problems below, then delete again."
              : "Nothing was saved. Fix the problems below, then save again."}
          </Banner>
        )}
        <FormulaFields
          draft={editor.primary}
          problems={editor.primaryProblems}
          onChange={editor.setPrimary}
          readOnly={editor.busy}
        />
        <FormulaFixes
          fixes={editor.fixes}
          onFixesChange={editor.setFixes}
          partFixes={editor.partFixes}
          onPartFixesChange={editor.setPartFixes}
          problems={editor.otherProblems}
          formulas={editor.formulas}
          readOnly={editor.busy}
          heading="Problems in other formulas and parts"
          onStopped={editor.stopFixing}
        />
      </FormSection>
    </form>
  );
}

function FormulaLinks({
  formulas,
  empty,
}: {
  formulas: FormulaDto[];
  empty: string;
}) {
  return formulas.length === 0 ? (
    <p className="text-fg-muted">{empty}</p>
  ) : (
    <ul className="flex flex-col gap-1.5">
      {formulas.map((formula) => (
        <li key={formula.id} className="min-w-0 truncate">
          <Link
            to={formulaPath(formula.id)}
            title={formula.name}
            className={cn(linkClass, "font-mono text-xs")}
          >
            {formula.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
