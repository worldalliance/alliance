import {
  CustomValidatorTypeDto,
  tasksCustomValidatorsAdmin,
} from "@alliance/shared/client";
import { useEffect, useState } from "react";

let cachedValidators: CustomValidatorTypeDto[] | null = null;
let cachedValidatorsError: string | null = null;
let pendingValidatorsRequest: Promise<CustomValidatorTypeDto[]> | null = null;

async function fetchCustomValidators(): Promise<CustomValidatorTypeDto[]> {
  const response = await tasksCustomValidatorsAdmin();
  if (response.data) {
    return response.data;
  }

  if (response.error) {
    throw response.error;
  }

  throw new Error("Unknown error loading custom validators");
}

export function resetCustomValidatorsCache(): void {
  cachedValidators = null;
  cachedValidatorsError = null;
}

export function useCustomValidators(): {
  validators: CustomValidatorTypeDto[];
  loading: boolean;
  error: string | null;
} {
  const [validators, setValidators] = useState<CustomValidatorTypeDto[]>(
    () => cachedValidators ?? [],
  );
  const [loading, setLoading] = useState<boolean>(
    () => !cachedValidators && !cachedValidatorsError,
  );
  const [error, setError] = useState<string | null>(
    () => cachedValidatorsError,
  );

  useEffect(() => {
    if (cachedValidators) {
      setLoading(false);
      return;
    }

    let isCancelled = false;
    if (!pendingValidatorsRequest) {
      pendingValidatorsRequest = fetchCustomValidators();
    }

    setLoading(true);

    pendingValidatorsRequest
      .then((data) => {
        if (isCancelled) return;
        cachedValidators = data;
        cachedValidatorsError = null;
        setValidators(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isCancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load validators";
        cachedValidatorsError = message;
        setError(message);
        setLoading(false);
      })
      .finally(() => {
        pendingValidatorsRequest = null;
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return {
    validators,
    loading,
    error,
  };
}
