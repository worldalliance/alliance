import React from "react";
import { useParams } from "react-router";
import { FormBuilder as FormBuilderComponent } from "../components/FormBuilder";

const FormBuilder: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();

  return (
    <FormBuilderComponent
      formId={formId && formId !== "new" ? formId : undefined}
    />
  );
};

export default FormBuilder;
