import type { CustomLinkDto } from "@alliance/shared/client";
import { useMemo, useRef, useState } from "react";
import { adminRefusalMessage, rowRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  useCreateCustomLinkAdmin,
  useCustomLinksAdmin,
  useDeleteCustomLinkAdmin,
} from "../../lib/useCustomLinksAdmin";
import Button from "../../ui/Button";
import { MoreMenu } from "../../ui/MoreMenu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { useFocusFirstInvalid } from "../../ui/templates/Form";
import {
  FilterBar,
  ListContent,
  listCount,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import { CustomLinkFields } from "./CustomLinkFields";
import {
  type CustomLinkErrors,
  customLinkUrl,
  EMPTY_CUSTOM_LINK,
  matchesCustomLink,
  validateCustomLink,
} from "./customLinkRules";
import { EditCustomLinkDialog } from "./EditCustomLinkDialog";
import { FailureBanner } from "./FailureBanner";
import { ListCreateForm } from "./ListCreateForm";
import { useCopyLink } from "./useCopyLink";

const VISITS_COLUMN = "text-right tabular-nums";

export function CustomLinksTab() {
  const [q, setQ] = useListSearch();
  const confirm = useConfirmOnPage();
  const links = useCustomLinksAdmin();
  const rows = useMemo(
    () => (links.data ?? []).filter((link) => matchesCustomLink(link, q)),
    [links.data, q],
  );

  const [draft, setDraft] = useState(EMPTY_CUSTOM_LINK);
  const [errors, setErrors] = useState<CustomLinkErrors>({});
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const [createRefusal, setCreateRefusal] = useState<string | null>(null);
  const create = useCreateCustomLinkAdmin({
    onSuccess: () => setDraft(EMPTY_CUSTOM_LINK),
    onError: (error) =>
      setCreateRefusal(
        adminRefusalMessage(error, "Couldn't create the custom link."),
      ),
  });
  const submit = () => {
    const validated = validateCustomLink(draft);
    if (!validated.ok) {
      setErrors(validated.error);
      focusFirstInvalid();
      return;
    }
    setCreateRefusal(null);
    create.mutate(validated.value);
  };

  const [failure, setFailure] = useState<string | null>(null);
  const copy = useCopyLink(setFailure);
  const [editing, setEditing] = useState<CustomLinkDto | null>(null);
  const searchRef = useRef<{ focus: () => void }>(null);
  const focus = useFocusAfterRemoval({
    ids: rows.map((link) => link.id),
    fallback: searchRef,
  });
  const remove = useDeleteCustomLinkAdmin({
    onSuccess: () => {},
    onError: () => {},
  });
  const deleteLink = async (link: CustomLinkDto) => {
    const confirmed = await confirm({
      title: `Delete the custom link “${link.label}”?`,
      message: `/${link.slug} stops working at once for everyone who has it, on flyers and QR codes included. A new link can take the path later.`,
      confirmLabel: "Delete link",
      destructive: true,
    });
    if (!confirmed) return;
    setFailure(null);
    remove.mutate(link.id, {
      onSuccess: focus.removing(link.id),
      onError: (error) =>
        setFailure(rowRefusalMessage(error, `Couldn't delete /${link.slug}`)),
    });
  };

  return (
    <>
      <RefreshFailedBanner things="custom links" query={links} />
      <FailureBanner message={failure} onDismiss={() => setFailure(null)} />
      <ListCreateForm
        label="New custom link"
        formRef={formRef}
        onSubmit={submit}
        submitLabel="Create link"
        busy={create.isPending}
        error={createRefusal}
        note="Visits count every arrival, repeat visits and automated requests included. Waitlist signups are reported under Organizations."
      >
        <CustomLinkFields
          row
          readOnly={create.isPending}
          values={draft}
          errors={errors}
          onChange={(next) => {
            setDraft(next);
            setErrors({});
          }}
          destinationHelp="A URL or a site path. Paste a waitlist link to keep its organization and signup attribution."
        />
      </ListCreateForm>
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: links.data?.length,
          noun: "custom link",
        })}
      >
        <SearchField
          ref={searchRef}
          label="Filter custom links"
          value={q}
          onChange={setQ}
        />
      </FilterBar>
      <ListContent>
        <ContentState
          things="custom links"
          query={links}
          refreshBanner={false}
          skeleton={
            <TableSkeleton
              bleed
              columns={5}
              columnClassNames={[
                undefined,
                undefined,
                undefined,
                VISITS_COLUMN,
              ]}
            />
          }
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No custom links yet"
          emptyDescription="A short path on the invite site that sends people to a destination you choose."
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead actions>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((link) => (
                <TableRow key={link.id} {...focus.row(link.id)}>
                  <TableCell truncate className="font-medium">
                    {link.label}
                  </TableCell>
                  <TableCell truncate>{`/${link.slug}`}</TableCell>
                  <TableCell truncate>{link.destination}</TableCell>
                  <TableCell className={VISITS_COLUMN}>
                    {formatCount(link.visits)}
                  </TableCell>
                  <TableCell actions>
                    <Button
                      size="small"
                      aria-label={`Copy link: /${link.slug}`}
                      onClick={() => void copy(customLinkUrl(link.slug))}
                    >
                      Copy link
                    </Button>
                    <MoreMenu
                      size="small"
                      subject={`/${link.slug}`}
                      busy={remove.isPending && remove.variables === link.id}
                      items={[
                        { label: "Edit…", onSelect: () => setEditing(link) },
                        {
                          label: "Delete",
                          destructive: true,
                          onSelect: () => void deleteLink(link),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
      {editing && (
        <EditCustomLinkDialog link={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
