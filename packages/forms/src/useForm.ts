/**
 * useForm Hook
 *
 * Form management with validation.
 */

import { useState, useCallback, useMemo } from 'preact/hooks';
import type { FormConfig, FormReturn, Validator } from './types.js';

/**
 * Use form hook
 */
export function useForm<T extends Record<string, unknown>>(
  config: FormConfig<T>
): FormReturn<T> {
  const {
    initialValues,
    validators = {},
    onSubmit,
    validateOnChange = false,
    validateOnBlur = true,
  } = config;

  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [valid, setValid] = useState(true);

  /**
   * Validate a single field
   */
  const validate = useCallback(
    (field: keyof T): boolean => {
      const fieldValidators = (validators as Record<string, Validator<T[keyof T]>[]>)[field as string];
      if (!fieldValidators) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
        return true;
      }

      const value = values[field];

      for (const validator of fieldValidators) {
        const result = validator.validate(value as T[keyof T]);
        if (!result.valid) {
          setErrors((prev) => ({ ...prev, [field]: result.error }));
          return false;
        }
      }

      setErrors((prev) => ({ ...prev, [field]: undefined }));
      return true;
    },
    [values, validators]
  );

  /**
   * Validate all fields
   */
  const validateAll = useCallback((): boolean => {
    const allFields = Object.keys(validators) as (keyof T)[];
    const results = allFields.map((field) => validate(field));
    const allValid = results.every((r) => r);
    setValid(allValid);
    return allValid;
  }, [validate, validators]);

  /**
   * Set a single value
   */
  const setValue = useCallback(
    (field: keyof T, value: T[keyof T]): void => {
      setValuesState((prev) => ({ ...prev, [field]: value }));

      if (validateOnChange) {
        validate(field);
      }
    },
    [validateOnChange, validate]
  );

  /**
   * Set multiple values
   */
  const setValues = useCallback(
    (newValues: Partial<T>): void => {
      setValuesState((prev) => ({ ...prev, ...newValues }));

      if (validateOnChange) {
        Object.keys(newValues).forEach((key) => {
          validate(key as keyof T);
        });
      }
    },
    [validateOnChange, validate]
  );

  /**
   * Set touched state
   */
  const setTouchedField = useCallback(
    (field: keyof T, isTouched: boolean): void => {
      setTouched((prev) => ({ ...prev, [field]: isTouched }));

      if (validateOnBlur && isTouched) {
        validate(field);
      }
    },
    [validateOnBlur, validate]
  );

  /**
   * Set error for a field
   */
  const setError = useCallback(
    (field: keyof T, error: string | undefined): void => {
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    []
  );

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e?: Event): Promise<void> => {
      e?.preventDefault();
      setSubmitting(true);

      // Validate all fields
      const allValid = validateAll();

      if (!allValid) {
        setSubmitting(false);
        return;
      }

      try {
        await onSubmit(values);
      } finally {
        setSubmitting(false);
      }
    },
    [values, validators, onSubmit, validateAll]
  );

  /**
   * Reset form
   */
  const reset = useCallback((): void => {
    setValuesState(initialValues);
    setErrors({});
    setTouched({});
    setSubmitting(false);
    setValid(true);
  }, [initialValues]);

  return useMemo(
    () => ({
      values,
      errors,
      touched,
      submitting,
      valid,
      setValue,
      setValues,
      setTouched: setTouchedField,
      setError,
      validate,
      validateAll,
      reset,
      handleSubmit,
    }),
    [
      values,
      errors,
      touched,
      submitting,
      valid,
      setValue,
      setValues,
      setTouchedField,
      setError,
      validate,
      validateAll,
      reset,
      handleSubmit,
    ]
  );
}

/**
 * Create form validator
 */
export function createValidator<T>(
  validateFn: (value: T) => boolean,
  errorMessage: string
): Validator<T> {
  return {
    validate: (value) => ({
      valid: validateFn(value),
      error: validateFn(value) ? undefined : errorMessage,
    }),
  };
}
