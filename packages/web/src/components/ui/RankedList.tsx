import './RankedList.css';

interface RankedListItem {
  id: string;
  name: string;
  value: number;
  subtitle?: string;
  badge?: string;
}

interface RankedListProps {
  items: RankedListItem[];
  emptyMessage?: string;
  emptyAction?: () => void;
  emptyActionLabel?: string;
}

export function RankedList({ items, emptyMessage, emptyAction, emptyActionLabel }: RankedListProps) {
  if (items.length === 0) {
    return (
      <div className="ranked-list-empty">
        <p className="ranked-list-empty-message">{emptyMessage || 'No data yet'}</p>
        {emptyAction && emptyActionLabel && (
          <button onClick={emptyAction} className="ranked-list-empty-action">
            {emptyActionLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="ranked-list">
      {items.map((item, index) => (
        <div key={item.id} className="ranked-list-item">
          <div className="ranked-list-rank">{index + 1}</div>
          <div className="ranked-list-content">
            <div className="ranked-list-name">{item.name}</div>
            {item.subtitle && <div className="ranked-list-subtitle">{item.subtitle}</div>}
          </div>
          <div className="ranked-list-value">
            {item.value}
            {item.badge && <span className="ranked-list-badge">{item.badge}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
