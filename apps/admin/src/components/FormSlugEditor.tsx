import {
  useFormsAdmin,
  useUpdateFormSlugAdmin,
} from "@alliance/shared/lib/useFormsAdmin";
import { SlugField } from "./SlugField";

/** The form's slug after its task's, as members' links read it. */
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
    <div className="flex min-w-0 flex-wrap items-center font-mono text-xs text-fg-muted">
      {actionPrefix}
      <SlugField
        slug={form.slug}
        saving={update.isPending}
        onSave={(slug) => update.mutateAsync({ formId, slug })}
      />
    </div>
  );
}
