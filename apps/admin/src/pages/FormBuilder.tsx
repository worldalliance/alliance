import React from "react";
import { useNavigate, useParams } from "react-router";
import { FormBuilder as FormBuilderComponent } from "../components/FormBuilder";

const FormBuilder: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();

  const navigate = useNavigate();

  const setFormId = (formId: number) => {
    navigate(`/tasks/forms/${formId}`);
  };

  return (
    <FormBuilderComponent
      formId={formId && formId !== "new" ? Number(formId) : undefined}
      setFormId={setFormId}
    />
  );
};

export default FormBuilder;
