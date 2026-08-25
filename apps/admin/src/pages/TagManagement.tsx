import { withCount } from "@alliance/common/plural";
import { CreateTagDto, TagDto } from "@alliance/shared/client/types.gen";
import { useTagsAdmin } from "@alliance/shared/lib/useTagsAdmin";
import { CardStyle } from "@alliance/shared/styles/card";
import Badge from "@alliance/sharedweb/ui/Badge";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

const INITIAL_NEW_TAG = {
  name: "",
  description: "",
  publicDisplayName: "",
};

const TagManagement: React.FC = () => {
  const { tags, isLoading, isError, createTag, updateTag, deleteTag } =
    useTagsAdmin();
  const { mutateAsync: createTagAsync } = createTag;
  const { mutateAsync: updateTagAsync } = updateTag;
  const { mutateAsync: deleteTagAsync } = deleteTag;
  const [error, setError] = useState<string | null>(null);
  const [newTag, setNewTag] = useState<CreateTagDto>(INITIAL_NEW_TAG);

  const sortedTags = useMemo(() => {
    return [...tags].sort((a, b) => a.name.localeCompare(b.name));
  }, [tags]);

  const handleCreateGroup = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const name = newTag.name.trim();
      const description = newTag.description.trim();
      const publicDisplayName = newTag.publicDisplayName?.trim();
      if (!name || !description) {
        setError("Name and description are required.");
        return;
      }
      setError(null);
      try {
        await createTagAsync({
          name,
          description,
          publicDisplayName: publicDisplayName || undefined,
        });
        setNewTag(INITIAL_NEW_TAG);
      } catch (err) {
        console.error("Failed to create tag", err);
        setError("Unable to create tag. Please try again.");
      }
    },
    [newTag, createTagAsync],
  );

  const handleUpdateTag = useCallback(
    async (tagId: string, values: CreateTagDto) => {
      setError(null);
      try {
        await updateTagAsync({
          tagId,
          body: {
            name: values.name.trim(),
            description: values.description.trim(),
            publicDisplayName: values.publicDisplayName?.trim() || undefined,
          },
        });
        return true;
      } catch (err) {
        console.error("Failed to update tag", err);
        setError("Unable to update tag. Please try again.");
        return false;
      }
    },
    [updateTagAsync],
  );

  const handleDeleteTag = useCallback(
    async (tagId: string) => {
      setError(null);
      try {
        await deleteTagAsync(tagId);
        return true;
      } catch (err) {
        console.error("Failed to delete tag", err);
        setError("Unable to delete tag. Please try again.");
        return false;
      }
    },
    [deleteTagAsync],
  );

  const errorMessage =
    error ?? (isError ? "Failed to load tags. Please try again." : null);

  return (
    <div className="h-full p-5 pt-20 flex flex-col items-center gap-y-4">
      {errorMessage && (
        <div className="w-full">
          <p className="text-sm text-red-500">{errorMessage}</p>
        </div>
      )}

      <div className="w-full max-w-4xl flex flex-col gap-3">
        <div className="w-full flex flex-row items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Tags</h2>
          <Link to="/members" className="text-sm text-blue-600 hover:underline">
            Back to members
          </Link>
        </div>
        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading groups...</p>
        ) : sortedTags.length ? (
          sortedTags.map((tag) => (
            <TagCard
              key={tag.id}
              tag={tag}
              onSave={(values) => handleUpdateTag(tag.id, values)}
              onDelete={() => handleDeleteTag(tag.id)}
              isUpdating={
                updateTag.isPending && updateTag.variables?.tagId === tag.id
              }
              isDeleting={deleteTag.isPending && deleteTag.variables === tag.id}
            />
          ))
        ) : (
          <p className="text-sm text-zinc-500">No tags yet.</p>
        )}
      </div>
      <Card className="w-full max-w-4xl" style={CardStyle.White}>
        <p className="font-bold mb-4">Create tag</p>
        <form className="flex flex-col gap-3" onSubmit={handleCreateGroup}>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-zinc-700"
              htmlFor="tag-name"
            >
              Tag name
            </label>
            <input
              id="tag-name"
              type="text"
              className="border border-zinc-300 rounded px-3 py-2 text-sm"
              value={newTag.name}
              onChange={(event) => {
                setError(null);
                setNewTag((prev) => ({
                  ...prev,
                  name: event.target.value,
                }));
              }}
              placeholder="Tag name"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-zinc-700"
              htmlFor="group-description"
            >
              Description
            </label>
            <textarea
              id="group-description"
              className="border border-zinc-300 rounded px-3 py-2 text-sm min-h-[80px]"
              value={newTag.description}
              onChange={(event) => {
                setError(null);
                setNewTag((prev) => ({
                  ...prev,
                  description: event.target.value,
                }));
              }}
              placeholder="What is this tag responsible for?"
            />
          </div>
          <Button
            type="submit"
            color={ButtonColor.Blue}
            className="self-start"
            disabled={createTag.isPending}
          >
            {createTag.isPending ? "Creating..." : "Create tag"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

type TagCardProps = {
  tag: TagDto;
  onSave: (values: CreateTagDto) => Promise<boolean> | boolean;
  onDelete: () => Promise<boolean> | boolean;
  isUpdating: boolean;
  isDeleting: boolean;
};

const TagCard: React.FC<TagCardProps> = ({
  tag,
  onSave,
  onDelete,
  isUpdating,
  isDeleting,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<CreateTagDto>({
    name: tag.name,
    description: tag.description,
    publicDisplayName: tag.publicDisplayName ?? "",
  });

  useEffect(() => {
    setFormValues({
      name: tag.name,
      description: tag.description,
      publicDisplayName: tag.publicDisplayName ?? "",
    });
  }, [tag]);

  const memberCount = tag.users.length;

  const handleSave = async () => {
    const result = await onSave(formValues);
    if (result) {
      setIsEditing(false);
    }
  };

  const confirmAndDelete = async () => {
    const confirmed = window.confirm(
      `Delete tag "${tag.name}"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    const result = await onDelete();
    if (result) {
      setIsEditing(false);
    }
  };

  return (
    <Card className="w-full" style={CardStyle.White}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-row items-center gap-3">
              <h3 className="font-semibold">{tag.name}</h3>
              <Badge>{withCount(memberCount, "member")}</Badge>
            </div>
            {tag.publicDisplayName && !isEditing && (
              <p className="text-sm text-zinc-500">
                Public name: {tag.publicDisplayName}
              </p>
            )}
          </div>
          <div className="flex flex-row gap-2">
            {isEditing ? (
              <>
                <Button
                  type="button"
                  color={ButtonColor.Light}
                  onClick={() => setIsEditing(false)}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  color={ButtonColor.Blue}
                  onClick={handleSave}
                  disabled={isUpdating}
                >
                  {isUpdating ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  color={ButtonColor.Light}
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  color={ButtonColor.Red}
                  onClick={confirmAndDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </>
            )}
          </div>
        </div>
        {isEditing ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">Name</label>
              <input
                type="text"
                className="border border-zinc-300 rounded px-3 py-2 text-sm"
                value={formValues.name}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">
                Public display name (optional)
              </label>
              <input
                type="text"
                className="border border-zinc-300 rounded px-3 py-2 text-sm"
                value={formValues.publicDisplayName}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    publicDisplayName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">
                Description
              </label>
              <textarea
                className="border border-zinc-300 rounded px-3 py-2 text-sm min-h-[80px]"
                value={formValues.description}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-zinc-700 whitespace-pre-wrap">
              {tag.description}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default TagManagement;
