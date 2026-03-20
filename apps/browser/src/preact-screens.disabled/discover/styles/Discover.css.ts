/**
 * Discover Screen Styles
 */

export const discoverStyles = {
  screen: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid #e1e8ed',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#657786',
  },
  content: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto' as const,
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: '#657786',
    marginBottom: '12px',
    textTransform: 'uppercase' as const,
  },
  matchCard: {
    background: 'white',
    border: '1px solid #e1e8ed',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    cursor: 'pointer',
  },
  matchHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  similarity: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
  },
  signalBars: {
    fontSize: '16px',
    letterSpacing: '2px',
  },
  description: {
    fontSize: '14px',
    color: '#14171a',
    marginBottom: '8px',
    lineHeight: 1.4,
  },
  meta: {
    fontSize: '12px',
    color: '#657786',
    display: 'flex',
    gap: '12px',
  },
  actionBtn: {
    padding: '8px 16px',
    background: '#1da1f2',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold' as const,
  },
  empty: {
    textAlign: 'center' as const,
    padding: '48px 16px',
    color: '#657786',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  refreshBtn: {
    display: 'block',
    margin: '16px auto',
    padding: '8px 24px',
    background: '#1da1f2',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '48px 16px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e1e8ed',
    borderTopColor: '#1da1f2',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto',
  },
};
