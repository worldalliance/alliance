import { tasksListForms } from "@alliance/shared/client";
import { client } from "@alliance/shared/client/client.gen";
import { FormSchema, Page } from "@alliance/shared/forms/formschema";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

export interface Form {
  id: number;
  title: string;
  schema: FormSchema<string, string>;
  pages: Page<string>[];
}

const FormsList: React.FC = () => {
  const [forms, setForms] = useState<Form[]>([]);
  const [formsLoading, setFormsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadForms = useCallback(async () => {
    try {
      const response = await tasksListForms();
      if (response.data) {
        setForms(response.data as unknown as Form[]);
      }
      setFormsLoading(false);
    } catch (err) {
      setError("Failed to load forms");
      setFormsLoading(false);
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  const handleCreateForm = useCallback(() => {
    navigate("/forms/new");
  }, [navigate]);

  const handleEditForm = useCallback(
    (id: number) => {
      navigate(`/forms/${id}`);
    },
    [navigate]
  );

  const handleDeleteForm = useCallback(
    async (id: number) => {
      if (confirm("Are you sure you want to delete this form?")) {
        try {
          await client.delete({
            url: `/tasks/${id}`,
          });
          // Reload forms after successful deletion
          loadForms();
        } catch (err) {
          console.error("Failed to delete form:", err);
          alert("Failed to delete form. Please try again.");
        }
      }
    },
    [loadForms]
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Forms</h2>
        <button
          onClick={handleCreateForm}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium"
        >
          Create New Form
        </button>
      </div>

      {formsLoading ? (
        <p>Loading forms...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : forms.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No forms found.</p>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto">
          {forms.map((form) => (
            <Card key={form.id} style={CardStyle.White}>
              <div className="flex justify-between items-start">
                <div
                  onClick={() => handleEditForm(form.id)}
                  className="cursor-pointer flex-1"
                >
                  <div className="flex justify-between mb-2">
                    <h3 className="font-bold text-sm">
                      {form.title || `Form ${form.id}`}
                    </h3>
                    <span className="text-xs text-gray-500">ID: {form.id}</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {form.schema.pages?.length || 0} page
                    {(form.schema.pages?.length || 0) !== 1 ? "s" : ""} •{" "}
                    {form.schema.pages?.reduce(
                      (total: number, page) => total + (page.fields?.length || 0),
                      0
                    ) || 0}{" "}
                    field
                    {(form.pages?.reduce(
                      (total: number, page) => total + (page.fields?.length || 0),
                      0
                    ) || 0) !== 1
                      ? "s"
                      : ""}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteForm(form.id);
                  }}
                  className="ml-2 p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  ×
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormsList;