import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import InternForm from '../components/forms/InternForm';
import Modal from '../components/common/Modal';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import internService from '../services/internService';
import locationService from '../services/locationService';
import { toast } from 'react-toastify';
import '../styles/interns.css';

const DEPARTMENTS = [
  'Computer Science',
  'Data Science',
  'Artificial Intelligence',
  'Electrical Engineering',
  'Other Engineering',
  'Other Sciences',
  'MS or Others',
];



const Interns = () => {
  const navigate = useNavigate();
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    locationService.getAll()
      .then(res => setLocations(res.data.data))
      .catch(() => {}); // non-critical — form just shows "No location assigned" if this fails
  }, []);

  const fetchInterns = useCallback(() => {
    setLoading(true);
    internService.getAll({ search, department, status: statusFilter })
      .then(res => setInterns(res.data.data))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [search, department, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchInterns, 300);
    return () => clearTimeout(timer);
  }, [fetchInterns]);

  const openAdd = () => { setSelected(null); setShowModal(true); };
  const openEdit = (intern) => { setSelected(intern); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setSelected(null); };

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (selected) {
        await internService.update(selected.id, data);
        toast.success('Intern updated');
      } else {
        await internService.create(data);
        toast.success('Intern added');
      }
      closeModal();
      fetchInterns();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await internService.delete(deleteId);
      toast.success('Intern deleted');
      setDeleteId(null);
      fetchInterns();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleStatus = async (intern) => {
    try {
      await internService.toggleStatus(intern.id);
      toast.success(`${intern.name} marked ${intern.status === 'active' ? 'inactive' : 'active'}`);
      fetchInterns();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <MainLayout title="Interns">
      <div className="page-header">
        <div className="filters-row">
          <input
            className="search-input"
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="filter-select"
            value={department}
            onChange={e => setDepartment(e.target.value)}
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Intern</button>
      </div>

      {loading ? <Loader /> : interns.length === 0 ? (
        <EmptyState message="No interns found" />
      ) : (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Joining Date</th>
                <th>Location</th>
                <th>Actions</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {interns.map(intern => (
                <tr key={intern.id}>
                  <td><span className="intern-name">{intern.name}</span></td>
                  <td><span className="text-muted">{intern.email}</span></td>
                  <td><span className="badge badge-muted">{intern.department}</span></td>
                  <td><span className="text-muted">{new Date(intern.joining_date).toLocaleDateString()}</span></td>
                  <td>
                    {intern.location_id
                      ? <span className="badge badge-muted">{locations.find(l => l.id === intern.location_id)?.name || 'Unknown'}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-view" onClick={() => navigate(`/interns/${intern.id}/profile`)}>View</button>
                      <button className="btn-edit" onClick={() => openEdit(intern)}>Edit</button>
                      <button className="btn-delete" onClick={() => setDeleteId(intern.id)}>Delete</button>
                      <button
                        className={intern.status === 'active' ? 'btn-delete' : 'btn-edit'}
                        onClick={() => handleToggleStatus(intern)}
                      >
                        {intern.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${intern.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {intern.status || 'active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={selected ? 'Edit Intern' : 'Add Intern'} onClose={closeModal}>
          <InternForm
            initial={selected}
            onSubmit={handleSubmit}
            submitting={submitting}
            onCancel={closeModal}
            departments={DEPARTMENTS}
            locations={locations}
          />
        </Modal>
      )}

      {deleteId && (
        <Modal title="Confirm Delete" onClose={() => setDeleteId(null)}>
          <p className="confirm-text">Are you sure you want to delete this intern? This will also delete all their tasks and attendance.</p>
          <div className="confirm-actions">
            <button className="btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
            <button className="btn-danger" onClick={handleDelete}>Delete</button>
          </div>
        </Modal>
      )}
    </MainLayout>
  );
};

export default Interns;
