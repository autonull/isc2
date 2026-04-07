/* eslint-disable */
/**
 * Validation Utilities
 *
 * Input validation and type checking utilities.
 */

/**
 * Validate required string
 * @param {*} value
 * @param {string} [fieldName='Value']
 * @returns {{valid:boolean,error?:string}}
 */
export function required(value, fieldName = 'Value') {
  if (value == null || value === '') {
    return { valid: false, error: `${fieldName} is required` };
  }
  return { valid: true };
}

/**
 * Validate string length
 * @param {string} value
 * @param {number} min
 * @param {number} max
 * @param {string} [fieldName='Value']
 * @returns {{valid:boolean,error?:string}}
 */
export function length(value, min, max, fieldName = 'Value') {
  const len = value?.length ?? 0;
  if (len < min) return { valid: false, error: `${fieldName} must be at least ${min} characters` };
  if (len > max) return { valid: false, error: `${fieldName} must be at most ${max} characters` };
  return { valid: true };
}

/**
 * Validate email format
 * @param {string} value
 * @param {string} [fieldName='Email']
 * @returns {{valid:boolean,error?:string}}
 */
export function email(value, fieldName = 'Email') {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (value && !re.test(value)) {
    return { valid: false, error: `${fieldName} must be a valid email address` };
  }
  return { valid: true };
}

/**
 * Validate number range
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @param {string} [fieldName='Value']
 * @returns {{valid:boolean,error?:string}}
 */
export function range(value, min, max, fieldName = 'Value') {
  const num = Number(value);
  if (Number.isNaN(num)) return { valid: false, error: `${fieldName} must be a number` };
  if (num < min) return { valid: false, error: `${fieldName} must be at least ${min}` };
  if (num > max) return { valid: false, error: `${fieldName} must be at most ${max}` };
  return { valid: true };
}

/**
 * Validate against custom pattern
 * @param {string} value
 * @param {RegExp} pattern
 * @param {string} message
 * @param {string} [fieldName='Value']
 * @returns {{valid:boolean,error?:string}}
 */
export function pattern(value, pattern, message, fieldName = 'Value') {
  if (value && !pattern.test(value)) {
    return { valid: false, error: `${fieldName}: ${message}` };
  }
  return { valid: true };
}

/**
 * Compose multiple validators
 * @param  {...Function} validators
 * @returns {Function}
 */
export function compose(...validators) {
  return value => {
    return validators.reduce((acc, validator) => {
      if (!acc.valid) return acc;
      return validator(value);
    }, { valid: true });
  };
}

/**
 * Validate form with schema
 * @param {Object} data
 * @param {Object<string,Function>} schema
 * @returns {{valid:boolean,errors:Object<string,string>}}
 */
export function validateForm(data, schema) {
  const errors = {};
  let valid = true;

  Object.entries(schema).forEach(([field, validator]) => {
    const result = validator(data[field]);
    if (!result.valid) {
      valid = false;
      errors[field] = result.error;
    }
  });

  return { valid, errors };
}

/**
 * Type guard: is non-null object
 * @param {*} value
 * @returns {value is Object}
 */
export function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type guard: is non-empty string
 * @param {*} value
 * @returns {value is string}
 */
export function isString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard: is positive integer
 * @param {*} value
 * @returns {value is number}
 */
export function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * Type guard: is valid date
 * @param {*} value
 * @returns {value is Date}
 */
export function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Sanitize object - remove null/undefined values
 * @param {Object} obj
 * @returns {Object}
 */
export function sanitize(obj) {
  if (!isObject(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v != null)
  );
}

/**
 * Deep clone with JSON (safe for plain objects)
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge objects deeply
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
 */
export function deepMerge(target, source) {
  const output = { ...target };

  Object.entries(source).forEach(([k, v]) => {
    if (isObject(v) && isObject(target[k])) {
      output[k] = deepMerge(target[k], v);
    } else {
      output[k] = v;
    }
  });

  return output;
}
