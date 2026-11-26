import { formSchemaToDisplayOnly } from "@alliance/common/forms/display-only-schema";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import { DisplayOnlyBlocks } from "@alliance/sharedweb/forms/DisplayOnlyRenderer";
import { Banner, BannerTone } from "../ui/templates/Banner";

export function DisplayOnlyPreview({
  schema,
  title,
}: {
  schema: FormSchema;
  title: string;
}) {
  return R.match(formSchemaToDisplayOnly(schema), {
    success: (displaySchema) => (
      <div className="member-surface w-full rounded-card border border-line bg-surface p-6 sm:p-8">
        <p className="mb-4 text-title-small">{title}</p>
        <DisplayOnlyBlocks {...displaySchema} />
      </div>
    ),
    failure: (errors) => (
      <Banner tone={BannerTone.Danger} inline>
        <p className="font-medium">This update can&apos;t be saved as-is</p>
        <ul className="mt-1 list-disc pl-5">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </Banner>
    ),
  });
}
