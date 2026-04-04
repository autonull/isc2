/**
 * Button Component
 *
 * Accessible button with variants.
 */

import type { JSX } from 'preact';
import { h } from 'preact';
import { useMemo } from 'preact/hooks';

/**
 * Button variants
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Button sizes
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Button props
 */
export interface ButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: JSX.Element;
  disabled?: boolean;
}

/**
 * Button component
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps): JSX.Element {
  const className = useMemo(() => {
    const base = 'isc-button';
    const variants: Record<ButtonVariant, string> = {
      primary: `${base}--primary`,
      secondary: `${base}--secondary`,
      ghost: `${base}--ghost`,
      danger: `${base}--danger`,
    };
    const sizes: Record<ButtonSize, string> = {
      sm: `${base}--sm`,
      md: `${base}--md`,
      lg: `${base}--lg`,
    };

    return [base, variants[variant], sizes[size], disabled || loading ? `${base}--disabled` : '']
      .filter(Boolean)
      .join(' ');
  }, [variant, size, disabled, loading]);

  return h(
    'button',
    {
      ...props,
      className,
      disabled: disabled || loading,
      'aria-busy': loading ? 'true' : undefined,
    },
    loading ? h('span', { class: 'isc-button__loader' }, 'Loading...') : children
  );
}
