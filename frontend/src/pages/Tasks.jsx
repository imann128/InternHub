import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import TaskForm from '../components/forms/TaskForm';
import Modal from '../components/common/Modal';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import Pagination from '../components/common/Pagination';
import taskService from '../services/taskService';
import internService from '../services/internService';
import submissionService from '../services/submissionService';
import { toast } from 'react-toastify';
import { WarningIcon, PaperclipIcon } from '../components/common/Icons';
import '../styles/interns.css';
import '../styles/tasks.css';

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [editTask, setEditTask] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [commentTask, setCommentTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [submissionsTask, setSubmissionsTask] = useState(null);
  const [taskSubmissions, setTaskSubmissions] = useState([]);
  const [reviewData, setReviewData] = useState({ status: 'approved', score: '', feedback: '' });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [submissionsPagination, setSubmissionsPagination] = useState(null);

  const fetchTasks = useCallback(() => {
    setLoading(true);
    taskService.getAll({ status: statusFilter, priority: priorityFilter, page, limit: 20 })
      .then(res => {
        setTasks(res.data.data);
        setPagination(res.data.pagination || null);
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter, priorityFilter, page]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => { setPage(1); }, [statusFilter, priorityFilter]);

  useEffect(() => {
    internService.getAll({})
      .then(res => setInterns(res.data.data))
      .catch(() => { });
  }, []);

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      await taskService.create(data);
      toast.success('Task assigned');
      setShowModal(false);
      fetchTasks();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusToggle = async (task) => {
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    try {
      await taskService.updateStatus(task.id, newStatus, task.version);
      toast.success(`Task marked ${newStatus}`);
      fetchTasks();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEdit = async (data) => {
    setSubmitting(true);
    try {
      await taskService.update(editTask.id, { ...data, version: editTask.version });
      toast.success('Task updated');
      setEditTask(null);
      fetchTasks();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await taskService.delete(id);
      toast.success('Task deleted');
      setDeleteConfirm(null);
      fetchTasks();
    } catch (err) { toast.error(err.message); }
  };

  const isOverdue = (task) =>
    task.due_date && task.status === 'pending' && new Date(task.due_date) < new Date();

  const priorityBadge = (p) => {
    const map = { high: 'badge-priority-high', medium: 'badge-priority-medium', low: 'badge-priority-low' };
    return <span className={`badge ${map[p] || 'badge-priority-medium'}`}>{p}</span>;
  };

  const openComments = async (task) => {
    setCommentTask(task);
    setCommentText('');
    try {
      const res = await taskService.getComments(task.id);
      setComments(res.data.data);
    } catch (err) { toast.error(err.message); }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setCommentLoading(true);
    try {
      await taskService.addComment(commentTask.id, commentText);
      toast.success('Comment added — intern notified');
      setCommentText('');
      const res = await taskService.getComments(commentTask.id);
      setComments(res.data.data);
    } catch (err) { toast.error(err.message); }
    finally { setCommentLoading(false); }
  };

  const openSubmissions = async (task) => {
    setSubmissionsTask(task);
    setSubmissionsPage(1);
    try {
      const res = await submissionService.getAll({ task_id: task.id, page: 1, limit: 20 });
      setTaskSubmissions(res.data.data);
      setSubmissionsPagination(res.data.pagination || null);
    } catch (err) { toast.error(err.message); }
  };

  const refetchSubmissions = useCallback(async (taskId, pageNum) => {
    try {
      const res = await submissionService.getAll({ task_id: taskId, page: pageNum, limit: 20 });
      setTaskSubmissions(res.data.data);
      setSubmissionsPagination(res.data.pagination || null);
    } catch (err) { toast.error(err.message); }
  }, []);

  useEffect(() => {
    if (submissionsTask) refetchSubmissions(submissionsTask.id, submissionsPage);
  }, [submissionsPage]);

  const handleReview = async (submissionId, version) => {
    setReviewLoading(true);
    try {
      await submissionService.review(submissionId, {
        status: reviewData.status,
        score: reviewData.score ? parseInt(reviewData.score) : undefined,
        feedback: reviewData.feedback,
        version,
      });
      toast.success('Review submitted');
      await refetchSubmissions(submissionsTask.id, submissionsPage);
    } catch (err) { toast.error(err.message); }
    finally { setReviewLoading(false); }
  };

  return (
    <MainLayout
      title="Tasks"
      action={<button className="btn-pill-primary" onClick={() => setShowModal(true)}>+ Assign task</button>}
    >
      <div className="page-stack">
        <div className="filters-row">
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
          <select className="filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {loading ? <Loader /> : tasks.length === 0 ? (
          <EmptyState message="No tasks found" />
        ) : (
          <div className="interns-table-wrap">
            <table className="interns-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Assigned to</th>
                  <th>Description</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due date</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id} className={isOverdue(task) ? 'task-row-overdue' : ''}>
                    <td><span className="intern-name">{task.title}</span></td>
                    <td>{task.intern_name}</td>
                    <td><span className="task-desc">{task.description || '—'}</span></td>
                    <td>{priorityBadge(task.priority)}</td>
                    <td>
                      <span className={`badge ${task.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                        {task.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: isOverdue(task) ? 'var(--danger)' : 'var(--muted-strong)' }}>
                        {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        {isOverdue(task) && <WarningIcon size={12} />}
                      </span>
                    </td>
                    <td>{new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    <td>
                      <div className="action-btns">
                        <button
                          className={`row-btn ${task.status === 'pending' ? 'row-btn-activate' : 'row-btn-deactivate'}`}
                          onClick={() => handleStatusToggle(task)}
                        >
                          {task.status === 'pending' ? 'Mark done' : 'Reopen'}
                        </button>
                        <button className="row-btn row-btn-edit" onClick={() => setEditTask(task)}>Edit</button>
                        <button className="row-btn row-btn-view" onClick={() => openComments(task)}>Notes</button>
                        <button className="row-btn row-btn-view" onClick={() => openSubmissions(task)}>Submissions</button>
                        <button className="row-btn row-btn-delete" onClick={() => setDeleteConfirm(task.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="Assign task" onClose={() => setShowModal(false)}>
          <TaskForm
            interns={interns}
            onSubmit={handleSubmit}
            submitting={submitting}
            onCancel={() => setShowModal(false)}
          />
        </Modal>
      )}

      {editTask && (
        <Modal title="Edit task" onClose={() => setEditTask(null)}>
          <TaskForm
            interns={interns}
            initialData={editTask}
            onSubmit={handleEdit}
            submitting={submitting}
            onCancel={() => setEditTask(null)}
          />
        </Modal>
      )}

      {deleteConfirm && (
        <Modal title="Delete Task" onClose={() => setDeleteConfirm(null)}>
          <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
            Are you sure you want to delete this task? This cannot be undone.
          </p>
          <div className="form-actions">
            <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn-delete" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
          </div>
        </Modal>
      )}

      {commentTask && (
        <Modal title={`Notes — ${commentTask.title}`} onClose={() => setCommentTask(null)}>
          <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
            {comments.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>No notes yet</p>
            ) : comments.map(c => (
              <div key={c.id} style={{ background: 'var(--bg-inset)', borderRadius: 12, padding: '10px 14px', marginBottom: 8, borderLeft: '3px solid var(--primary)' }}>
                <p style={{ margin: 0, color: 'var(--text)', fontSize: 13 }}>{c.comment}</p>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(c.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              placeholder="Add a note..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddComment()}
              style={{ flex: 1 }}
            />
            <button className="btn-primary" onClick={handleAddComment} disabled={commentLoading}>
              {commentLoading ? '...' : 'Add'}
            </button>
          </div>
        </Modal>
      )}

      {submissionsTask && (
        <Modal title={`Submissions — ${submissionsTask.title}`} onClose={() => setSubmissionsTask(null)}>
          {taskSubmissions.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>No submissions yet</p>
          ) : taskSubmissions.map(s => (
            <div key={s.id} style={{ background: 'var(--bg-inset)', borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{s.intern_name}</span>
                <span style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 99, fontWeight: 600,
                  background: s.status === 'approved' ? 'var(--accent-teal-light)' : s.status === 'rejected' ? 'var(--danger-light)' : 'var(--warning-light)',
                  color: s.status === 'approved' ? 'var(--accent-teal)' : s.status === 'rejected' ? 'var(--danger)' : 'var(--warning)'
                }}>
                  {s.status.replace('_', ' ')}
                </span>
              </div>
              {s.notes && <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{s.notes}</p>}
              {s.files?.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {s.files.map(f => (
                    <button key={f.id} onClick={() => submissionService.download(s.id, f.id, f.file_name)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginRight: 12 }}>
                      <PaperclipIcon size={12} /> {f.file_name}
                    </button>
                  ))}
                </div>
              )}
              {s.score != null && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Score: {s.score}/100</p>}
              {s.feedback && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{s.feedback}</p>}
              {s.status === 'submitted' || s.status === 'revision_requested' ? (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <select className="form-input" style={{ flex: 1 }}
                      value={reviewData.status} onChange={e => setReviewData(p => ({ ...p, status: e.target.value }))}>
                      <option value="approved">Approve</option>
                      <option value="rejected">Reject</option>
                      <option value="revision_requested">Request Revision</option>
                    </select>
                    <input className="form-input" type="number" placeholder="Score /100" style={{ width: 100 }}
                      value={reviewData.score} onChange={e => setReviewData(p => ({ ...p, score: e.target.value }))} />
                  </div>
                  <textarea className="form-input" rows={2} placeholder="Feedback (optional)"
                    value={reviewData.feedback} onChange={e => setReviewData(p => ({ ...p, feedback: e.target.value }))}
                    style={{ marginBottom: 8, resize: 'vertical' }} />
                  <button className="btn-primary" onClick={() => handleReview(s.id, s.version)} disabled={reviewLoading}>
                    {reviewLoading ? '...' : 'Submit Review'}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          <Pagination pagination={submissionsPagination} onPageChange={setSubmissionsPage} />
        </Modal>
      )}
    </MainLayout>
  );
};

export default Tasks;
