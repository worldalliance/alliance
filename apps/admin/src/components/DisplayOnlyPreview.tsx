import { formSchemaToDisplayOnly } from "@alliance/common/forms/display-only-schema";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import DisplayOnlyRenderer from "@alliance/sharedweb/forms/DisplayOnlyRenderer";
import Card from "@alliance/sharedweb/ui/Card";

export function DisplayOnlyPreview({
  schema,
  title,
}: {
  schema: FormSchema;
  title: string;
}) {
  return R.match(formSchemaToDisplayOnly(schema), {
    success: (displaySchema) => (
      <Card className="p-6 sm:p-8 w-full border-[1.5px] rounded">
        <p className="text-title-small mb-4">{title}</p>
        <DisplayOnlyRenderer schema={displaySchema} />
      </Card>
    ),
    failure: (errors) => (
      <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">
        <p className="font-medium">This update can&apos;t be saved as-is</p>
        <ul className="mt-1 list-disc pl-5 text-sm">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </div>
    ),
  });
}
