import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import EmptyState from '../common/EmptyState';

const COLORS = {
  completed: 'var(--accent-teal)',
  pending: 'var(--warning)',
};
const FALLBACK_COLOR = 'var(--accent-purple)';

const TaskStatusChart = ({ data }) => {
  if (!data || data.length === 0) return <EmptyState message="No task data yet" compact />;

  const formatted = data.map(d => ({
    name: d.status,
    value: parseInt(d.count, 10),
    color: COLORS[d.status] || FALLBACK_COLOR,
  }));

  return (
    <div className="donut-row">
      <div style={{ width: 120, height: 120, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={formatted} cx="50%" cy="50%" innerRadius={44} outerRadius={58} dataKey="value" paddingAngle={3} stroke="none">
              {formatted.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="donut-legend">
        {formatted.map((entry, i) => (
          <div key={i} className="donut-legend-row">
            <span className="donut-legend-key">
              <span className="donut-legend-dot" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="donut-legend-count">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskStatusChart;
