/**
 * @isc/forms - Form Validation
 *
 * Shared form validation logic.
 */

export {
  useForm,
  createValidator,
} from './useForm.js';
export {
  required,
  minLength,
  maxLength,
  pattern,
  email,
  number,
  minValue,
  maxValue,
  range,
  custom,
  oneOf,
  notOneOf,
  compose,
  iscValidators,
} from './validators.js';
export type {
  ValidationResult,
  Validator,
  ValidatorFn,
  FieldValidators,
  FormConfig,
  FormState,
  FormReturn,
  ISCDomainValidators,
} from './types.js';
