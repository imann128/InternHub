import './common.css';

const colorMap = {
  primary: { bg: 'var(--primary-light)', color: 'var(--primary)' },
  success: { bg: 'var(--accent-teal-light)', color: 'var(--accent-teal)' },
  warning: { bg: 'var(--warning-light)', color: 'var(--warning)' },
  muted:   { bg: 'var(--bg-panel)', color: 'var(--muted-strong)' },
};

const StatCard = ({ label, value, color }) => {
  const { bg, color: textColor } = colorMap[color] || colorMap.muted;
  return (
    <div className="stat-card" style={{ background: bg }}>
      <div className="stat-value" style={{ color: textColor }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
};

export default StatCard;