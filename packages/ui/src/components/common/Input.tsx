/**
 * Input Component
 *
 * Accessible text input with validation.
 */

import type { JSX } from 'preact';
import { h } from 'preact';
import { useMemo } from 'preact/hooks';

/**
 * Input sizes
 */
export type InputSize = 'sm' | 'md' | 'lg';

/**
 * Input props
 */
export interface InputProps extends Omit<JSX.HTMLAttributes<HTMLInputElement>, 'size' | 'id'> {
  label?: string;
  error?: string | null;
  size?: InputSize;
  hint?: string;
  id?: string;
}

/**
 * Input component
 */
export function Input({
  label,
  error,
  size = 'md',
  hint,
  id,
  className,
  'aria-describedby': ariaDescribedby,
  ...props
}: InputProps): JSX.Element {
  const inputId = (id as string) || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const describedBy = useMemo(() => {
    const parts: string[] = [];
    if (error) {parts.push(errorId);}
    if (hint) {parts.push(hintId);}
    if (ariaDescribedby && typeof ariaDescribedby === 'string') {parts.push(ariaDescribedby);}
    return parts.join(' ') || undefined;
  }, [error, hint, ariaDescribedby, errorId, hintId]);

  const classNameStr = useMemo(() => {
    const base = 'isc-input';
    const sizeClass = size === 'sm' ? `${base}--sm` : size === 'lg' ? `${base}--lg` : `${base}--md`;
    const errorClass = error ? `${base}--error` : '';
    const extra = typeof className === 'string' ? className : '';
    return `${base} ${sizeClass} ${errorClass} ${extra}`.trim();
  }, [size, error, className]);

  return h(
    'div',
    { class: 'isc-input__wrapper' },
    label
      ? h(
          'label',
          { for: inputId, class: 'isc-input__label' },
          label
        )
      : null,
    h('input', {
      ...props,
      id: inputId,
      class: classNameStr,
      'aria-invalid': error ? 'true' : undefined,
      'aria-describedby': describedBy,
    }),
    hint && !error
      ? h(
          'p',
          { id: hintId, class: 'isc-input__hint' },
          hint
        )
      : null,
    error
      ? h(
          'p',
          { id: errorId, class: 'isc-input__error' },
          error
        )
      : null
  );
}
