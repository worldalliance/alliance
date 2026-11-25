import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { useCurrentContract } from "@alliance/shared/lib/useCurrentContract";
import { useParams } from "react-router";
import { useContentConfirm } from "../../components/useContentConfirm";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { useContractAdmin } from "../../lib/useContractAdmin";
import { useContractsAdmin } from "../../lib/useContractsAdmin";
import { RecordId } from "../../places";
import Badge from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { Banner } from "../../ui/templates/Banner";
import { FormSection, SaveBar } from "../../ui/templates/Form";
import { Page, PageBody } from "../../ui/templates/Page";
import {
  ContentState,
  FormSkeleton,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import { ContractFields } from "./ContractFields";
import { JOIN_PATHS, saveNoteOf } from "./contractForm";
import {
  contractName,
  CONTRACTS_HREF,
  ContractStatus,
  inForceOf,
  STATUS_LABEL,
  STATUS_TONE,
  statusOf,
} from "./contractRules";
import { useContractForm, type ContractFormState } from "./useContractForm";

const NEW = "new";

const ACTIVE_NOTICE =
  "Members are asked to sign this contract now, and the public site quotes it.";

export default function ContractPage() {
  const { id } = useParams();
  // Keyed, so the form of one contract never carries over to the next.
  return <ContractRecord key={id} idParam={id ?? NEW} />;
}

const memberTime = (value: string) =>
  formatDateTime(value, { timeZone: LAUNCH_TIME_ZONE });

function ContractRecord({ idParam }: { idParam: string }) {
  const isNew = idParam === NEW;
  const parsedId = isNew ? NaN : Number(idParam);
  const contractId = Number.isInteger(parsedId) ? parsedId : null;

  const admin = useContractAdmin(contractId);
  const { query } = admin;
  const contract = query.data;
  const { confirmSave, dialog: contentDialog } = useContentConfirm();
  const current = useCurrentContract();
  const list = useContractsAdmin();
  const details = useContractForm({
    contractId,
    contracts: list.data ?? null,
    admin,
    confirmSave,
  });
  const now = new Date();
  // A failed current-contract load reads as null, so the list's dates stand in.
  const activeId =
    current.data?.id ?? (list.data && inForceOf(list.data, now)?.id) ?? null;
  const activeKnown = !current.isPending && (!!current.data || !list.isPending);
  // The server answers a missing contract with a 500, after retries, so a
  // fresh list without the id is what tells "not found" from a failed load.
  const listed = list.data?.find((candidate) => candidate.id === contractId);
  const missingFromList =
    !query.data && list.isSuccess && list.isFetchedAfterMount && !listed;
  const notFound =
    !isNew &&
    (contractId === null ||
      thrownStatus(query.error) === 404 ||
      missingFromList);
  // While the fresh list is on its way a failed load may yet be "not found".
  const failed =
    query.isError && !(list.isFetching && !list.isFetchedAfterMount);
  const loading = !notFound && !details.filled && !failed;

  const statusFrom = contract ?? listed;
  const status =
    statusFrom && activeKnown ? statusOf(statusFrom, { activeId, now }) : null;

  const form = (
    <ContractForm
      details={details}
      contractId={isNew ? null : contractId}
      note={saveNoteOf({
        form: details.form,
        contractId: isNew ? null : contractId,
        contracts: list.data ?? null,
        activeId: activeKnown ? activeId : null,
        pointsChanged: details.pointsChanged,
        now,
      })}
    />
  );

  if (isNew) {
    return (
      <Page
        record={RecordId.Contract}
        title="New contract"
        description={`Members are asked to sign it ${JOIN_PATHS} only once its start date has passed.`}
      >
        {contentDialog}
        {form}
      </Page>
    );
  }

  return (
    <Page
      record={RecordId.Contract}
      title={contract ? contractName(contract) : undefined}
      badge={
        status && (
          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
        )
      }
      description={
        contract
          ? [
              contract.startDate
                ? `Starts ${memberTime(contract.startDate)}`
                : "No start date",
              contract.endDate
                ? `Ends ${memberTime(contract.endDate)}`
                : "No end date",
              `Created ${formatDateTime(contract.createdAt)}`,
            ].join(" · ")
          : ""
      }
      banner={
        <>
          <RefreshFailedBanner things="this contract" query={query} />
          {status === ContractStatus.Active && <Banner>{ACTIVE_NOTICE}</Banner>}
        </>
      }
      // The list a visit usually comes from already says whether it's active.
      bannerPending={loading && status === null}
    >
      {contentDialog}
      <ContentState
        loading={loading}
        skeleton={
          <PageBody width="form">
            <FormSkeleton fields={5} />
          </PageBody>
        }
        error={
          !notFound && !details.filled && failed
            ? adminRefusalMessage(query.error, LOAD_FAILED_FALLBACK)
            : null
        }
        errorTitle="Couldn't load this contract"
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        empty={notFound}
        emptyTitle="Contract not found"
        emptyDescription="Check the link, or find it in the list."
        emptyAction={
          <Button variant={ButtonVariant.Default} to={CONTRACTS_HREF}>
            All contracts
          </Button>
        }
      >
        {form}
      </ContentState>
    </Page>
  );
}

function ContractForm({
  details,
  contractId,
  note,
}: {
  details: ContractFormState;
  contractId: number | null;
  note: string;
}) {
  return (
    <PageBody width="form">
      <form
        ref={details.formRef}
        onSubmit={(event) => void details.submit(event)}
        noValidate
      >
        <FormSection
          title="Contract"
          footer={
            <SaveBar
              state={details.state}
              error={details.saveError}
              note={note}
              saveLabel={
                contractId === null ? "Create contract" : "Save changes"
              }
              onDiscard={details.discard}
            />
          }
        >
          <ContractFields
            form={details.form}
            setForm={details.setForm}
            errors={details.errors}
            contractId={contractId}
          />
        </FormSection>
      </form>
    </PageBody>
  );
}
