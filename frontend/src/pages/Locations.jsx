import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import LocationForm from '../components/forms/LocationForm';
import AssignInternsPanel from '../components/forms/AssignInternsPanel';
import Modal from '../components/common/Modal';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import locationService from '../services/locationService';
import internService from '../services/internService';
import { toast } from 'react-toastify';
import '../styles/interns.css';

const Locations = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [interns, setInterns] = useState([]);
  const [manageLocation, setManageLocation] = useState(null);
  const [assigning, setAssigning] = useState(false);

  const fetchLocations = useCallback(() => {
    setLoading(true);
    locationService.getAll()
      .then(res => setLocations(res.data.data))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  const openAdd = () => { setSelected(null); setShowModal(true); };
  const openEdit = (location) => { setSelected(location); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setSelected(null); };

  const openManageInterns = (location) => {
    internService.getAll({})
      .then(res => {
        setInterns(res.data.data);
        setManageLocation(location);
      })
      .catch(err => toast.error(err.message));
  };
  const closeManageInterns = () => setManageLocation(null);

  const handleAssignInterns = async (internIds) => {
    setAssigning(true);
    try {
      await locationService.assignInterns(manageLocation.id, internIds);
      toast.success(`Interns updated for ${manageLocation.name}`);
      closeManageInterns();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (selected) {
        await locationService.update(selected.id, data);
        toast.success('Location updated');
      } else {
        await locationService.create(data);
        toast.success('Location added');
      }
      closeModal();
      fetchLocations();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (location) => {
    try {
      if (location.is_active) {
        await locationService.deactivate(location.id, location.version);
        toast.success(`${location.name} deactivated`);
      } else {
        await locationService.activate(location.id, location.version);
        toast.success(`${location.name} reactivated`);
      }
      fetchLocations();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <MainLayout
      title="Locations"
      subtitle="Interns can only check in/out within the radius of their assigned location."
      action={<button className="btn-pill-primary" onClick={openAdd}>+ Add location</button>}
    >
      <div className="page-stack">
        {loading ? <Loader /> : locations.length === 0 ? (
          <EmptyState message="No locations set up yet" />
        ) : (
          <div className="interns-table-wrap">
            <table className="interns-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Coordinates</th>
                  <th>Radius</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map(location => (
                  <tr key={location.id}>
                    <td><span className="intern-name">{location.name}</span></td>
                    <td>{Number(location.latitude).toFixed(6)}, {Number(location.longitude).toFixed(6)}</td>
                    <td>{location.radius_meters}m</td>
                    <td>
                      <span className={`badge ${location.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {location.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="row-btn row-btn-edit" onClick={() => openEdit(location)}>Edit</button>
                        <button className="row-btn row-btn-view" onClick={() => openManageInterns(location)}>Manage interns</button>
                        <button
                          className={`row-btn ${location.is_active ? 'row-btn-deactivate' : 'row-btn-activate'}`}
                          onClick={() => handleToggleActive(location)}
                        >
                          {location.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title={selected ? 'Edit location' : 'Add location'} onClose={closeModal}>
          <LocationForm
            initial={selected}
            onSubmit={handleSubmit}
            submitting={submitting}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {manageLocation && (
        <Modal title={`Manage interns — ${manageLocation.name}`} onClose={closeManageInterns}>
          <AssignInternsPanel
            location={manageLocation}
            allInterns={interns}
            allLocations={locations}
            submitting={assigning}
            onSubmit={handleAssignInterns}
            onCancel={closeManageInterns}
          />
        </Modal>
      )}
    </MainLayout>
  );
};

export default Locations;
