import { customLinkFieldsSchema } from "@alliance/common/customLinks";
import type {
  CustomLinkDto,
  UpdateCustomLinkDto,
} from "@alliance/shared/client";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Copy } from "lucide-react";
import React, { useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import InlineTextInput from "../components/InlineTextInput";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  useCreateCustomLinkAdmin,
  useCustomLinksAdmin,
  useDeleteCustomLinkAdmin,
  useUpdateCustomLinkAdmin,
} from "../lib/useCustomLinksAdmin";
import { useRefusalToast } from "../lib/useRefusalToast";

const INITIAL_LINK = { label: "", slug: "", destination: "" };
const INPUT_CLASS = "border border-zinc-300 rounded px-2 py-1 mt-1";
const INLINE_CLASS =
  "w-full border border-transparent hover:border-zinc-300 focus:border-zinc-400 rounded px-1 py-0.5";

const CustomLinksPage: React.FC = () => {
  const links = useCustomLinksAdmin();
  const refusalToast = useRefusalToast();
  const { success, error: toastError } = useToast();
  const [draft, setDraft] = useState(INITIAL_LINK);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CustomLinkDto | null>(null);
  const create = useCreateCustomLinkAdmin({
    onSuccess: () => {
      setDraft(INITIAL_LINK);
      setValidationError(null);
    },
    onError: (err) => refusalToast(err, "Could not create the custom link."),
  });
  const update = useUpdateCustomLinkAdmin({
    onError: (err) => refusalToast(err, "Could not update the custom link."),
  });
  const remove = useDeleteCustomLinkAdmin({
    onSuccess: () => setDeleting(null),
    onError: (err) => refusalToast(err, "Could not delete the custom link."),
  });

  const save = (params: {
    link: CustomLinkDto;
    body: UpdateCustomLinkDto;
    done: () => void;
  }) => {
    const parsed = customLinkFieldsSchema.partial().safeParse(params.body);
    if (!parsed.success) {
      toastError(parsed.error.issues[0].message);
      return;
    }
    update.mutate(
      { id: params.link.id, body: parsed.data },
      { onSuccess: params.done },
    );
  };

  const copy = async (slug: string) => {
    if (await copyToClipboard(`${getInviteBaseUrl()}/${slug}`))
      success("Link copied.");
    else toastError("Could not copy the link.");
  };

  return (
    <div className="p-5 space-y-4">
      <title>Custom Links - Admin</title>
      <div>
        <h1 className="text-lg font-bold text-zinc-900">Custom links</h1>
        <p className="text-sm text-zinc-600 mt-1 max-w-3xl">
          Short URLs for flyers, QR codes, and campaigns. Paste a waitlist link
          as the destination to keep its organization and signup attribution.
        </p>
      </div>
      <form
        className="flex flex-wrap gap-3 items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = customLinkFieldsSchema.safeParse(draft);
          if (!parsed.success) {
            setValidationError(parsed.error.issues[0].message);
            return;
          }
          setValidationError(null);
          create.mutate(parsed.data);
        }}
      >
        <label className="flex flex-col text-sm text-zinc-700">
          Label
          <input
            className={INPUT_CLASS}
            value={draft.label}
            maxLength={200}
            required
            readOnly={create.isPending}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="100k flyer"
          />
        </label>
        <label className="flex flex-col text-sm text-zinc-700">
          Path
          <input
            className={INPUT_CLASS}
            value={draft.slug}
            maxLength={65}
            required
            readOnly={create.isPending}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            placeholder="/100k"
          />
        </label>
        <label className="flex flex-col text-sm text-zinc-700 flex-1 min-w-64">
          Destination
          <input
            className={INPUT_CLASS}
            value={draft.destination}
            maxLength={2048}
            required
            readOnly={create.isPending}
            onChange={(e) =>
              setDraft({ ...draft, destination: e.target.value })
            }
            placeholder="Paste a destination URL or site path"
          />
        </label>
        <Button
          type="submit"
          size="small"
          color={ButtonColor.Black}
          disabled={create.isPending}
        >
          Create link
        </Button>
      </form>
      {validationError && (
        <p role="alert" className="text-sm text-red-600">
          {validationError}
        </p>
      )}
      <p className="text-xs text-zinc-500">
        Visits count arrivals, including repeat visits and automated requests.
        Waitlist signups are reported under Organizations.
      </p>
      {links.isPending ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : links.error ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-red-600">
            {adminRefusalMessage(links.error, "Unable to load custom links.")}
          </p>
          <Button size="small" onClick={() => void links.refetch()}>
            Retry
          </Button>
        </div>
      ) : links.data?.length === 0 ? (
        <p className="text-sm text-zinc-500">No custom links yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-zinc-200">
            <thead className="bg-zinc-50 text-left">
              <tr>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Path</th>
                <th className="px-3 py-2">Destination</th>
                <th className="px-3 py-2">Visits</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {links.data?.map((link) => (
                <tr key={link.id} className="border-t border-zinc-200">
                  <td className="px-3 py-2">
                    <InlineTextInput
                      aria-label={`Label for /${link.slug}`}
                      className={INLINE_CLASS}
                      value={link.label}
                      maxLength={200}
                      disabled={update.isPending}
                      onSave={(label, done) =>
                        save({ link, body: { label }, done })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <InlineTextInput
                        aria-label={`Path for /${link.slug}`}
                        className={INLINE_CLASS}
                        value={`/${link.slug}`}
                        maxLength={65}
                        disabled={update.isPending}
                        onSave={(slug, done) =>
                          save({ link, body: { slug }, done })
                        }
                      />
                      <button
                        type="button"
                        aria-label={`Copy /${link.slug}`}
                        title="Copy link"
                        onClick={() => void copy(link.slug)}
                        className="text-zinc-500 hover:text-black"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 min-w-64">
                    <InlineTextInput
                      aria-label={`Destination for /${link.slug}`}
                      className={INLINE_CLASS}
                      value={link.destination}
                      maxLength={2048}
                      disabled={update.isPending}
                      onSave={(destination, done) =>
                        save({ link, body: { destination }, done })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{link.visits}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      color={ButtonColor.Transparent}
                      size="small"
                      disabled={remove.isPending || update.isPending}
                      onClick={() => setDeleting(link)}
                    >
                      Delete link
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        isOpen={deleting !== null}
        title="Delete this custom link?"
        message={`/${deleting?.slug} will stop working. Its visit count will be deleted. This cannot be undone.`}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
        isLoading={remove.isPending}
      />
    </div>
  );
};

export default CustomLinksPage;
