/**
 * Modal Component
 *
 * Accessible modal dialog with focus trap.
 */

import type { JSX } from 'preact';
import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { trapFocus, saveFocus, announce } from '../../styles/accessibility.js';

/**
 * Modal sizes
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Modal props
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: JSX.Element;
  size?: ModalSize;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
}

/**
 * Modal component
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnEscape = true,
  closeOnBackdrop = true,
}: ModalProps): JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen || !modalRef.current) {return;}

    // Save focus for restoration
    previouslyFocused.current = document.activeElement as HTMLElement;
    const restoreFocus = saveFocus();

    // Trap focus within modal
    const releaseFocus = trapFocus(modalRef.current);

    // Announce modal to screen readers
    announce(`${title} dialog opened`);

    // Handle escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      releaseFocus();
      restoreFocus();
      document.removeEventListener('keydown', handleEscape);
      announce('Dialog closed');
    };
  }, [isOpen, title, onClose, closeOnEscape]);

  if (!isOpen) {return null;}

  const handleBackdropClick = (event: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  const sizeClass = `isc-modal--${size}`;

  return h(
    'div',
    {
      class: `isc-modal__backdrop ${sizeClass}`,
      onClick: handleBackdropClick,
      role: 'presentation',
    },
    h(
      'div',
      {
        ref: modalRef,
        class: 'isc-modal',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'modal-title',
      },
      h(
        'div',
        { class: 'isc-modal__header' },
        h(
          'h2',
          { id: 'modal-title', class: 'isc-modal__title' },
          title
        ),
        h(
          'button',
          {
            class: 'isc-modal__close',
            onClick: onClose,
            'aria-label': 'Close dialog',
          },
          '×'
        )
      ),
      h('div', { class: 'isc-modal__content' }, children),
      h('div', { class: 'isc-modal__footer' })
    )
  );
}
