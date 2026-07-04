import EmptyState from '../common/EmptyState';

const PALETTE = ['var(--primary)', 'var(--accent-teal)', 'var(--warning)', 'var(--accent-purple)'];

const DepartmentChart = ({ data }) => {
  if (!data || data.length === 0) return <EmptyState message="No department data yet" compact />;

  const formatted = data.map(d => ({ name: d.department, count: parseInt(d.count, 10) }));
  const max = Math.max(...formatted.map(d => d.count), 1);

  return (
    <div className="dept-list">
      {formatted.map((d, i) => (
        <div key={d.name}>
          <div className="dept-row-header">
            <span className="dept-row-name">{d.name}</span>
            <span className="dept-row-count">{d.count}</span>
          </div>
          <div className="dept-bar-track">
            <div
              className="dept-bar-fill"
              style={{ width: `${(d.count / max) * 100}%`, background: PALETTE[i % PALETTE.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default DepartmentChart;
