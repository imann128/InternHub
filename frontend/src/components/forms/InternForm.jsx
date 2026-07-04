import { useState } from 'react';
import '../../styles/forms.css';

const InternForm = ({ initial, onSubmit, submitting, onCancel, departments, locations }) => {
  const [form, setForm] = useState({
    name: initial?.name || '',
    email: initial?.email || '',
    department: initial?.department || '',
    joining_date: initial?.joining_date?.slice(0, 10) || '',
    location_id: initial?.location_id || '',
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.department) e.department = 'Department is required';
    if (!form.joining_date) e.joining_date = 'Joining date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setErrors(p => ({ ...p, [e.target.name]: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // version is only present on edit (see internController.update) —
    // required by the backend's optimistic-lock check so two admins editing
    // the same intern don't silently clobber each other. Absent on create.
    if (validate()) onSubmit(initial?.version != null ? { ...form, version: initial.version } : form);
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label className="form-label">Name</label>
        <input className={`form-input ${errors.name ? 'input-error' : ''}`} name="name" value={form.name} onChange={handleChange} placeholder="Full name" />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label className="form-label">Email</label>
        <input className={`form-input ${errors.email ? 'input-error' : ''}`} name="email" value={form.email} onChange={handleChange} placeholder="email@example.com" />
        {errors.email && <span className="form-error">{errors.email}</span>}
      </div>

      <div className="form-group">
        <label className="form-label">Department</label>
        <select className={`form-input ${errors.department ? 'input-error' : ''}`} name="department" value={form.department} onChange={handleChange}>
          <option value="">Select department</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {errors.department && <span className="form-error">{errors.department}</span>}
      </div>

      <div className="form-group">
        <label className="form-label">Joining Date</label>
        <input className={`form-input ${errors.joining_date ? 'input-error' : ''}`} type="date" name="joining_date" value={form.joining_date} onChange={handleChange} />
        {errors.joining_date && <span className="form-error">{errors.joining_date}</span>}
      </div>

      <div className="form-group">
        <label className="form-label">Check-in Location</label>
        <select className="form-input" name="location_id" value={form.location_id} onChange={handleChange}>
          <option value="">No location assigned</option>
          {(locations || []).filter(l => l.is_active || String(l.id) === String(form.location_id)).map(l => (
            <option key={l.id} value={l.id}>{l.name}{!l.is_active ? ' (inactive)' : ''}</option>
          ))}
        </select>
        <span className="form-hint" style={{ fontSize: 12, color: 'var(--muted)' }}>
          Without a location assigned, this intern can't check in via the intern portal.
        </span>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : initial ? 'Save changes' : 'Add intern'}
        </button>
      </div>
    </form>
  );
};

export default InternForm;
