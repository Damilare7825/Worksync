import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useWorkSync } from '../../context/WorkSyncContext';

export function ProjectModal() {
  const { isProjectModalOpen, setIsProjectModalOpen, editingProject, setEditingProject, addProject, updateProject } =
    useWorkSync();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [due, setDue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isProjectModalOpen) return;
    setError('');
    if (editingProject) {
      setName(editingProject.name || '');
      setDescription(editingProject.description || '');
      setDue(editingProject.dueDate ? editingProject.dueDate.slice(0, 10) : '');
    } else {
      setName('');
      setDescription('');
      setDue('');
    }
  }, [editingProject, isProjectModalOpen]);

  const close = () => {
    setIsProjectModalOpen(false);
    setEditingProject(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (editingProject) {
        await updateProject(editingProject.id, { name, description, due });
      } else {
        await addProject({ name, description, due });
      }
      close();
    } catch (err) {
      setError(err.message || `Could not ${editingProject ? 'update' : 'create'} project`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isProjectModalOpen}
      onClose={close}
      title={editingProject ? 'Edit Project' : 'Create New Project'}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{error}</div>}
        <Input
          label="Project Name"
          placeholder="e.g. Mobile App 2.0"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
            Description
          </label>
          <textarea
            rows={3}
            placeholder="Project goals, scope, and target outcomes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Input
          label="Target Due Date"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
