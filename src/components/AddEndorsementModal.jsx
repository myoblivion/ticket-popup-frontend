// src/components/AddEndorsementModal.jsx
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const AddEndorsementModal = ({ 
  isOpen, 
  onClose, 
  teamId, 
  onEndorsementAdded, 
  t,
  categoriesList = [],
  membersList = [],
  manageCategories 
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(''); 
  const [category, setCategory] = useState('');
  const [assignees, setAssignees] = useState([]); 
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setCategory(categoriesList.length > 0 ? categoriesList[0] : 'General');
      setAssignees([]);
      setError('');
      setIsSaving(false);
    }
  }, [isOpen, categoriesList]); 

  if (!isOpen) return null;

  const toggleAssignee = (uid) => {
    setAssignees(prev => {
      if (prev.includes(uid)) return prev.filter(id => id !== uid);
      return [...prev, uid];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError(t('common.requiredFields', 'Project Title is required.')); return; }
    if (!teamId) { setError("Team ID is missing."); return; }

    setIsSaving(true);
    setError('');

    try {
      const currentUser = auth.currentUser;
      const userName = currentUser?.displayName || currentUser?.email || 'Unknown User';
      const userId = currentUser?.uid || 'anonymous';

      const initialHistory = [{
        action: 'Created Project',
        by: userName,
        timestamp: new Date().toISOString()
      }];

      await addDoc(collection(db, 'teams', teamId, 'handovers'), {
        title: title,
        description: description, 
        category: category,
        priority: 'Medium',
        status: 'Not Started', 
        assignees: assignees,
        postedBy: userName, 
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        history: initialHistory,
        projectTasks: [], 
      });

      await addDoc(collection(db, 'teams', teamId, 'workLogs'), {
          type: 'project_creation',
          action: `Created Project: ${title}`,
          userName: userName,
          userId: userId,
          createdAt: serverTimestamp(),
          details: `Category: ${category}`
      });

      if (onEndorsementAdded) onEndorsementAdded();
      onClose(); 
    } catch (err) {
      console.error("Error creating project:", err);
      setError(t('common.errorSave', 'Failed to save.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* WIDENED MODAL HERE: max-w-2xl */}
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b bg-gray-50 rounded-t-lg">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Create New Project</h2>
            <p className="text-xs text-gray-500 mt-1">Set up a new project container.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <form id="create-project-form" onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Project Title <span className="text-red-500">*</span></label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-lg" placeholder="e.g., Website Redesign" />
            </div>
            
            {/* Category with Manage Button */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <div className="flex gap-2">
                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)} 
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white focus:ring-blue-500 focus:border-blue-500"
                  >
                    {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  
                  {manageCategories && (
                      <button 
                        type="button" 
                        onClick={manageCategories} 
                        className="px-3 py-2 bg-gray-100 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-200 text-xs font-medium"
                        title="Add or remove categories"
                      >
                        Manage
                      </button>
                  )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea rows="5" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Briefly describe the project..." />
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">Assign Team Members</label>
               <div className="border border-gray-200 rounded-md p-3 max-h-40 overflow-y-auto bg-gray-50">
                  {membersList.length === 0 ? <p className="text-xs text-gray-500 italic">No members found.</p> : (
                      <div className="grid grid-cols-2 gap-2">
                        {membersList.map((m) => {
                           const mUid = typeof m === 'object' ? m.uid : m;
                           const mLabel = typeof m === 'object' ? m.label : m; 
                           const isSelected = assignees.includes(mUid);
                           return (
                             <label key={mUid} className={`flex items-center gap-3 p-2 rounded cursor-pointer border transition-colors ${isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                <input type="checkbox" checked={isSelected} onChange={() => toggleAssignee(mUid)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                                <span className="text-sm text-gray-700 truncate select-none">{mLabel}</span>
                             </label>
                           );
                        })}
                      </div>
                  )}
               </div>
            </div>
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>}
          </form>
        </div>
        <div className="flex justify-end items-center gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">{t('common.cancel', 'Cancel')}</button>
          <button type="submit" form="create-project-form" disabled={isSaving} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center shadow-sm">
            {isSaving && <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>}
            {t('common.save', 'Create Project')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddEndorsementModal;