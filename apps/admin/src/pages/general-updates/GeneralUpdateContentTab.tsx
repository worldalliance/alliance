import {
  displayOnlyToFormSchema,
  readDisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import type { GeneralUpdateAdminDto } from "@alliance/shared/client";
import { FormBuilder } from "../../components/FormBuilder";
import type { useGeneralUpdateAdmin } from "../../lib/useGeneralUpdateAdmin";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { PageBody } from "../../ui/templates/Page";

export function GeneralUpdateContentTab({
  update,
  saveSchema,
}: {
  update: GeneralUpdateAdminDto;
  saveSchema: ReturnType<typeof useGeneralUpdateAdmin>["saveSchema"];
}) {
  // Editing content this build can't parse would save back whatever the
  // builder made of it, dropping the parts it didn't understand.
  const storedSchema = readDisplayOnlySchema(update.schema);
  if (!storedSchema) {
    return (
      <PageBody>
        <Banner inline tone={BannerTone.Danger}>
          <p className="font-medium">This update can&apos;t be edited here</p>
          <p>
            Its content was saved by a newer version of the admin panel. Refresh
            the page to pick that version up.
          </p>
        </Banner>
      </PageBody>
    );
  }
  return (
    <FormBuilder
      displayOnly
      initialSchema={displayOnlyToFormSchema(storedSchema)}
      initialSnapshotId={update.schemaSnapshotId}
      title={update.name}
      setFormId={() => {}}
      onSave={saveSchema}
    />
  );
}
