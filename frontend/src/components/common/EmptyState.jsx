import './common.css';

const EmptyState = ({ message = 'No data found', compact = false }) => (
  <div className={compact ? 'empty-state empty-state-compact' : 'empty-state'}>
    <div className="empty-icon">○</div>
    <p className="empty-text">{message}</p>
  </div>
);

export default EmptyState;