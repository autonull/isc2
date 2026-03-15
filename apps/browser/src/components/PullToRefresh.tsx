/**
 * Pull-to-Refresh Component
 * 
 * Enables pull-to-refresh gesture on mobile devices.
 * Provides visual feedback during refresh.
 */

import { h, Component } from 'preact';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: any;
  threshold?: number;
  refreshing?: boolean;
}

interface PullToRefreshState {
  pulling: boolean;
  pulledDistance: number;
  refreshing: boolean;
}

const styles = {
  container: {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    height: '100%',
  },
  content: {
    transition: 'transform 0.2s ease',
  },
  indicator: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: 'translateY(-100%)',
    transition: 'transform 0.2s ease',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid rgba(29, 161, 242, 0.3)',
    borderTop: '3px solid #1da1f2',
    borderRadius: '50%',
    animation: 'ptr-spin 1s linear infinite',
  },
  text: {
    marginLeft: '8px',
    fontSize: '14px',
    color: '#657786',
  },
};

export class PullToRefresh extends Component<PullToRefreshProps, PullToRefreshState> {
  private touchStartY = 0;
  private touchCurrentY = 0;
  private contentRef: HTMLElement | null = null;

  constructor(props: PullToRefreshProps) {
    super(props);
    this.state = {
      pulling: false,
      pulledDistance: 0,
      refreshing: props.refreshing || false,
    };
  }

  static getDerivedStateFromProps(props: PullToRefreshProps, state: PullToRefreshState) {
    if (props.refreshing !== undefined && props.refreshing !== state.refreshing) {
      return { refreshing: props.refreshing };
    }
    return null;
  }

  handleTouchStart = (e: TouchEvent): void => {
    if (this.contentRef && this.contentRef.scrollTop === 0) {
      this.touchStartY = e.touches[0].clientY;
      this.setState({ pulling: true, pulledDistance: 0 });
    }
  };

  handleTouchMove = (e: TouchEvent): void => {
    if (!this.state.pulling) return;

    this.touchCurrentY = e.touches[0].clientY;
    const diff = this.touchCurrentY - this.touchStartY;
    
    if (diff > 0) {
      e.preventDefault();
      const resistance = Math.min(diff, 150);
      this.setState({ pulledDistance: resistance * 0.5 });
    }
  };

  handleTouchEnd = async (): Promise<void> => {
    if (!this.state.pulling) return;

    const { pulledDistance } = this.state;
    const threshold = this.props.threshold || 80;

    this.setState({ pulling: false, pulledDistance: 0 });

    if (pulledDistance >= threshold && !this.state.refreshing) {
      this.setState({ refreshing: true });
      try {
        await this.props.onRefresh();
      } finally {
        this.setState({ refreshing: false });
      }
    }
  };

  componentDidMount() {
    if (this.contentRef) {
      this.contentRef.addEventListener('touchstart', this.handleTouchStart, { passive: true });
      this.contentRef.addEventListener('touchmove', this.handleTouchMove, { passive: false });
      this.contentRef.addEventListener('touchend', this.handleTouchEnd);
    }
  }

  componentWillUnmount() {
    if (this.contentRef) {
      this.contentRef.removeEventListener('touchstart', this.handleTouchStart);
      this.contentRef.removeEventListener('touchmove', this.handleTouchMove);
      this.contentRef.removeEventListener('touchend', this.handleTouchEnd);
    }
  }

  render() {
    const { children } = this.props;
    const { pulling, pulledDistance, refreshing } = this.state;

    const contentStyle = {
      ...styles.content,
      transform: `translateY(${pulledDistance}px)`,
    };

    const indicatorStyle = {
      ...styles.indicator,
      transform: `translateY(${-100 + pulledDistance}%)`,
    };

    return (
      <div style={styles.container}>
        {/* Pull Indicator */}
        {(pulling || refreshing) && (
          <div style={indicatorStyle}>
            <div style={styles.spinner} />
            <span style={styles.text}>
              {refreshing ? 'Refreshing...' : 'Release to refresh'}
            </span>
          </div>
        )}

        {/* Content */}
        <div 
          ref={el => { this.contentRef = el; }}
          style={contentStyle}
        >
          {children}
        </div>

        {/* CSS for spinner animation */}
        <style>{`
          @keyframes ptr-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
}

/**
 * Hook-based pull-to-refresh for functional components
 */
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pulledDistance, setPulledDistance] = useState(0);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return { refreshing, pulling, pulledDistance, onRefresh: handleRefresh };
}

// Simple useState for the hook
function useState<T>(initial: T): [T, (v: T) => void] {
  let state = initial;
  const setters: ((v: T) => void)[] = [];
  
  const setState = (v: T) => {
    state = v;
    setters.forEach(fn => fn(v));
  };
  
  return [state, setState];
}

/**
 * Simple refresh button for desktop
 */
export function RefreshButton({ 
  onClick, 
  loading,
  label = 'Refresh'
}: { 
  onClick: () => void | Promise<void>;
  loading?: boolean;
  label?: string;
}) {
  const styles = {
    button: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      background: 'white',
      border: '1px solid #e1e8ed',
      borderRadius: '20px',
      cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.6 : 1,
      fontSize: '14px',
      color: '#1da1f2',
      fontWeight: 500 as const,
    },
    spinner: {
      width: '16px',
      height: '16px',
      border: '2px solid rgba(29, 161, 242, 0.3)',
      borderTop: '2px solid #1da1f2',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    },
  };

  return (
    <button 
      style={styles.button} 
      onClick={onClick}
      disabled={loading}
      aria-label={label}
    >
      {loading ? (
        <div style={styles.spinner} />
      ) : (
        '🔄'
      )}
      <span>{loading ? 'Refreshing...' : label}</span>
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}
