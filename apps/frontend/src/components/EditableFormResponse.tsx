import { FormSchema } from "@alliance/common/forms/form-schema";
import {
    FormResponseDto,
    SubmitFormDto,
    tasksEditFormResponse,
} from "@alliance/shared/client";
import { computeFormStorageKey } from "@alliance/shared/formrenderer";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import { useState } from "react";

interface EditableFormResponseProps {
    formResponse: FormResponseDto;
    actionId: number;
    onSaved: (updated: FormResponseDto) => void;
    onCancel: () => void;
}

const EditableFormResponse = ({
    formResponse,
    actionId,
    onSaved,
    onCancel,
}: EditableFormResponseProps) => {
    const [error, setError] = useState<string | null>(null);

    const clearEditDraft = () => {
        if (typeof window === "undefined") return;
        const key = computeFormStorageKey({
            formId: formResponse.formId,
            instanceId: `edit-${formResponse.id}`,
        });
        window.localStorage.removeItem(key);
    };

    const handleSubmit = async (data: SubmitFormDto): Promise<boolean> => {
        setError(null);
        const response = await tasksEditFormResponse({
            path: { formId: formResponse.formId },
            body: { answers: data.answers, deviceType: data.deviceType, publicAnswers: data.publicAnswers },
        });
        if (response.response.ok && response.data) {
            clearEditDraft();
            onSaved(response.data);
            return true;
        }
        setError("Failed to save changes.");
        return false;
    };

    const handleCancel = () => {
        clearEditDraft();
        onCancel();
    };

    return (
        <div>
            <FormRenderer
                form={formResponse.schemaSnapshot as unknown as FormSchema}
                id={formResponse.formId}
                formSnapshotId={formResponse.formSnapshotId}
                actionId={actionId}
                draftFormResponse={formResponse}
                persistKey={`edit-${formResponse.id}`}
                onSubmit={handleSubmit}
                renderFormAsCompleted={false}
            />
            <button
                type="button"
                onClick={handleCancel}
                className="mt-2 text-sm text-zinc-500"
            >
                Cancel
            </button>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
    );
};

export default EditableFormResponse;