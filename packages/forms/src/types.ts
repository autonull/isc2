/**
 * Forms Type Definitions
 *
 * Form validation types.
 */

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validator interface
 */
export interface Validator<T> {
  validate(value: T, context?: unknown): ValidationResult;
}

/**
 * Validator function
 */
export type ValidatorFn<T> = (value: T, context?: unknown) => ValidationResult;

/**
 * Field validators map
 */
export type FieldValidators<T extends Record<string, unknown>> = {
  [K in keyof T]?: Array<Validator<T[K]>>;
};

/**
 * Form config
 */
export interface FormConfig<T extends Record<string, unknown>> {
  initialValues: T;
  validators?: FieldValidators<T>;
  onSubmit: (values: T) => Promise<void> | void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

/**
 * Form state
 */
export interface FormState<T extends Record<string, unknown>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  submitting: boolean;
  valid: boolean;
}

/**
 * Form return type
 */
export interface FormReturn<T extends Record<string, unknown>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  submitting: boolean;
  valid: boolean;
  setValue: (field: keyof T, value: T[keyof T]) => void;
  setValues: (values: Partial<T>) => void;
  setTouched: (field: keyof T, touched: boolean) => void;
  setError: (field: keyof T, error: string | undefined) => void;
  validate: (field: keyof T) => boolean;
  validateAll: () => boolean;
  reset: () => void;
  handleSubmit: (e?: Event) => Promise<void>;
}

/**
 * ISC domain-specific validators
 */
export interface ISCDomainValidators {
  channelName: () => Validator<string>;
  channelDescription: () => Validator<string>;
  peerId: () => Validator<string>;
  channelSpread: () => Validator<number>;
  relationTag: () => Validator<string>;
  relationWeight: () => Validator<number>;
}
