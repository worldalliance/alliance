import type { FormulaDto, MemberListDto } from "@alliance/shared/client";
import { useState } from "react";
import { useParams } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { MEMBER_LISTS_HREF } from "../../lib/hrefs";
import { useFormulasAdmin } from "../../lib/useFormulasAdmin";
import { useMemberListsAdmin } from "../../lib/useMemberListsAdmin";
import { RecordId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Page, PageBody } from "../../ui/templates/Page";
import {
  ContentState,
  FormSkeleton,
  LOAD_FAILED_FALLBACK,
} from "../../ui/templates/States";
import { MemberListForm } from "./MemberListForm";
import { couldExist, NEW } from "./memberListRules";
import { useMemberListEditor } from "./useMemberListEditor";

type Opened = { stored: MemberListDto | undefined; formulas: FormulaDto[] };

export default function MemberListPage() {
  const { listId = NEW } = useParams();
  // A link to another list keeps this route mounted; the key opens it afresh.
  return <MemberListRecord key={listId} listId={listId} />;
}

function MemberListRecord({ listId }: { listId: string }) {
  const isNew = listId === NEW;
  const lists = useMemberListsAdmin();
  const formulas = useFormulasAdmin();
  // The editor opens on its own fetches, not a cached list or formula with an
  // older version, which would make the first save a conflict. It keeps what
  // it opened with, so a refetch or its own delete never unmounts it.
  const [opened, setOpened] = useState<Opened | null>(null);
  if (
    opened === null &&
    lists.isSuccess &&
    lists.isFetchedAfterMount &&
    formulas.isSuccess &&
    formulas.isFetchedAfterMount
  ) {
    setOpened({
      stored: lists.data.find((list) => list.id === listId),
      formulas: formulas.data,
    });
  }
  const notFound =
    !isNew &&
    (!couldExist(listId) || (opened !== null && opened.stored === undefined));
  if (opened !== null && !notFound) {
    return <MemberListEditorPage opened={opened} />;
  }

  const failed = lists.isError ? lists.error : formulas.error;
  return (
    <Page
      record={RecordId.MemberList}
      title={isNew ? "New member list" : undefined}
      description=""
    >
      <ContentState
        loading={!notFound && failed === null}
        skeleton={
          <PageBody width="form">
            <FormSkeleton fields={3} />
          </PageBody>
        }
        error={
          !notFound && failed !== null
            ? adminRefusalMessage(failed, LOAD_FAILED_FALLBACK)
            : null
        }
        errorTitle={
          isNew
            ? "Couldn't load what a new list needs"
            : "Couldn't load this member list"
        }
        onRetry={() => {
          if (lists.isError) void lists.refetch();
          if (formulas.isError) void formulas.refetch();
        }}
        retrying={lists.isFetching || formulas.isFetching}
        empty={notFound}
        emptyTitle="Member list not found"
        emptyDescription="It may have been deleted."
        emptyAction={
          <Button variant={ButtonVariant.Default} to={MEMBER_LISTS_HREF}>
            All member lists
          </Button>
        }
      >
        {null}
      </ContentState>
    </Page>
  );
}

function MemberListEditorPage({ opened }: { opened: Opened }) {
  const editor = useMemberListEditor({
    opened: opened.stored,
    formulas: opened.formulas,
  });
  const { stored, refusal } = editor;
  return (
    <Page
      record={RecordId.MemberList}
      title={stored?.name ?? "New member list"}
      description={
        stored === undefined ? "" : countOf(stored.userIds.length, "member")
      }
      actions={
        stored !== undefined && (
          <Button
            ref={editor.deleteButton}
            variant={ButtonVariant.DangerOutline}
            busy={editor.deleting}
            disabled={editor.busy && !editor.deleting}
            onClick={() => void editor.remove()}
          >
            Delete list
          </Button>
        )
      }
      banner={
        <>
          {refusal && (
            <Banner
              tone={BannerTone.Danger}
              action={
                refusal.outdated ? (
                  <Button
                    size="small"
                    variant={ButtonVariant.Ghost}
                    onClick={() => window.location.reload()}
                  >
                    Reload
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant={ButtonVariant.Ghost}
                    onClick={editor.dismissRefusal}
                  >
                    Dismiss
                  </Button>
                )
              }
            >
              {refusal.message}
            </Banner>
          )}
          {editor.problems.length > 0 && (
            <Banner tone={BannerTone.Danger}>
              Nothing was deleted. Fix the problems below, then delete again.
            </Banner>
          )}
        </>
      }
    >
      <MemberListForm editor={editor} formulas={opened.formulas} />
    </Page>
  );
}
