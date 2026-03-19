/**
 * Filter Bar Component
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { discoverStyles as styles } from '../styles/Discover.css.js';
import type { ProximityLevel } from '../types/discover.js';

interface FilterBarProps {
  onFilterChange?: (filters: FilterState) => void;
}

interface FilterState {
  searchQuery: string;
  proximityLevel: ProximityLevel | 'ALL';
  minSimilarity: number;
}

const PROXIMITY_OPTIONS: Array<{ label: string; value: ProximityLevel | 'ALL' }> = [
  { label: 'All Matches', value: 'ALL' },
  { label: 'Very Close (85%+)', value: 'VERY_CLOSE' },
  { label: 'Nearby (70%+)', value: 'NEARBY' },
  { label: 'Orbiting (55%+)', value: 'ORBITING' },
];

export function FilterBar({ onFilterChange }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    proximityLevel: 'ALL',
    minSimilarity: 0.55,
  });

  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  return (
    <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <input
        type="text"
        placeholder="Search peers..."
        value={filters.searchQuery}
        onInput={(e) =>
          updateFilter('searchQuery', (e.target as HTMLInputElement).value)
        }
        style={{
          padding: '8px 12px',
          border: '1px solid #e1e8ed',
          borderRadius: '4px',
          fontSize: '14px',
          flex: 1,
          minWidth: '200px',
        }}
      />

      <select
        value={filters.proximityLevel}
        onChange={(e) =>
          updateFilter(
            'proximityLevel',
            (e.target as HTMLSelectElement).value as ProximityLevel | 'ALL'
          )
        }
        style={{
          padding: '8px 12px',
          border: '1px solid #e1e8ed',
          borderRadius: '4px',
          fontSize: '14px',
          background: 'white',
        }}
      >
        {PROXIMITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
