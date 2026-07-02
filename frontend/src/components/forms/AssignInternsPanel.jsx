import { useState, useMemo } from 'react';
import '../../styles/forms.css';

// Checkbox list used from the Locations page to bulk-assign interns to a
// single location. Sends the full checked-set on save; the backend replaces
// the location's whole intern list in one transaction (see
// LocationModel.assignInterns), so unchecking someone here unassigns them.
const AssignInternsPanel = ({ location, allInterns, allLocations, submitting, onSubmit, onCancel }) => {
  const [checked, setChecked] = useState(
    () => new Set(allInterns.filter(i => i.location_id === location.id).map(i => i.id))
  );
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allInterns;
    return allInterns.filter(i => i.name.toLowerCase().includes(q) || i.email.toLowerCase().includes(q));
  }, [allInterns, search]);

  const toggle = (id) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(Array.from(checked));
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <input
          className="form-input"
          placeholder="Search interns..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border, #E5E7EB)', borderRadius: 8, marginBottom: 16 }}>
        {filtered.length === 0 ? (
          <p style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>No interns found</p>
        ) : filtered.map(intern => {
          const assignedElsewhere = intern.location_id && intern.location_id !== location.id;
          return (
            <label
              key={intern.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderBottom: '1px solid var(--border, #F1F5F9)', cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={checked.has(intern.id)}
                onChange={() => toggle(intern.id)}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{intern.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{intern.email} · {intern.department}</div>
              </div>
              {assignedElsewhere && (
                <span className="badge badge-muted" style={{ fontSize: 11 }}>
                  Currently: {allLocations.find(l => l.id === intern.location_id)?.name || 'another location'}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
        {checked.size} intern{checked.size === 1 ? '' : 's'} will be assigned to {location.name}.
        Unchecking someone removes them from this location.
      </p>

      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
};

export default AssignInternsPanel;
