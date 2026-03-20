/**
 * Onboarding Form Validator
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateChannelName(name: string): ValidationResult {
  if (!name || !name.trim()) {
    return { valid: false, error: 'Channel name is required' };
  }

  if (name.trim().length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }

  if (name.length > 50) {
    return { valid: false, error: 'Name must be less than 50 characters' };
  }

  return { valid: true };
}

export function validateDescription(description: string): ValidationResult {
  if (!description || !description.trim()) {
    return { valid: false, error: 'Description is required' };
  }

  if (description.trim().length < 10) {
    return { valid: false, error: 'Description must be at least 10 characters' };
  }

  if (description.length > 500) {
    return { valid: false, error: 'Description must be less than 500 characters' };
  }

  return { valid: true };
}

export function validateCreateChannelForm(
  name: string,
  description: string
): ValidationResult {
  const nameResult = validateChannelName(name);
  if (!nameResult.valid) return nameResult;

  const descResult = validateDescription(description);
  if (!descResult.valid) return descResult;

  return { valid: true };
}
