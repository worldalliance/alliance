import {
  useFormsAdmin,
  useUpdateFormSlugAdmin,
} from "@alliance/shared/lib/useFormsAdmin";
import { SlugField } from "./SlugField";

export default function FormSlugEditor({ formId }: { formId: number }) {
  const { forms } = useFormsAdmin();
  const update = useUpdateFormSlugAdmin();
  const form = forms.find(({ id }) => id === formId);
  if (!form) return null;
  const actionPrefix = form.displaySlug.slice(
    0,
    form.displaySlug.length - form.slug.length,
  );
  return (
    <div className="flex items-center whitespace-nowrap font-mono text-sm text-zinc-500">
      {actionPrefix}
      <SlugField
        slug={form.slug}
        saving={update.isPending}
        onSave={(slug) => update.mutateAsync({ formId, slug })}
      />
    </div>
  );
}
