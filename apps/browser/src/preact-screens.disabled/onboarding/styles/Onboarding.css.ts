/**
 * Onboarding Styles
 */

export const onboardingStyles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    background: 'white',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
  },
  progress: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
  },
  progressDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#e1e8ed',
    transition: 'background 0.3s',
  },
  progressDotActive: {
    background: '#1da1f2',
  },
  icon: {
    fontSize: '64px',
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold' as const,
    marginBottom: '12px',
    textAlign: 'center' as const,
  },
  description: {
    fontSize: '16px',
    color: '#657786',
    marginBottom: '24px',
    textAlign: 'center' as const,
    lineHeight: 1.5,
  },
  featureList: {
    marginBottom: '24px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  featureIcon: {
    fontSize: '20px',
  },
  buttonContainer: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  button: {
    padding: '12px 32px',
    borderRadius: '24px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    transition: 'transform 0.2s',
  },
  primaryBtn: {
    background: '#1da1f2',
    color: 'white',
  },
  secondaryBtn: {
    background: '#f7f9fa',
    color: '#657786',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e1e8ed',
    borderRadius: '8px',
    fontSize: '16px',
    marginBottom: '16px',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e1e8ed',
    borderRadius: '8px',
    fontSize: '16px',
    minHeight: '100px',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
  error: {
    color: '#e0245e',
    fontSize: '14px',
    marginTop: '8px',
    textAlign: 'center' as const,
  },
};
