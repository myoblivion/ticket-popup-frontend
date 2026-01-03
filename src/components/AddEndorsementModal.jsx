// src/components/AddEndorsementModal.jsx
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { addDoc, collection, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

// Helper Icons
const PlusSmIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>;
const TrashIcon = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

const AddEndorsementModal = ({ isOpen, onClose, teamId, t, categoriesList, membersList, onEndorsementAdded, parentId = null }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  
  // Local state to show updates immediately without waiting for parent refresh
  const [localCategories, setLocalCategories] = useState([]); 
  
  const [newCategory, setNewCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync local state with props when modal opens or props change
  useEffect(() => {
      if (isOpen) {
          setLocalCategories(categoriesList || []);
      }
  }, [categoriesList, isOpen]);

  if (!isOpen) return null;

  // --- HANDLE ADD CATEGORY ---
  const handleAddCategory = async () => {
      const val = newCategory.trim();
      if (!val) return;
      if (localCategories.includes(val)) {
          alert("Category already exists");
          return;
      }

      // 1. Optimistic UI Update (Update list immediately)
      const updatedList = [...localCategories, val];
      setLocalCategories(updatedList);
      setCategory(val);
      setNewCategory('');
      setIsAddingCategory(false);

      // 2. Update Database
      try {
          const teamRef = doc(db, 'teams', teamId);
          await updateDoc(teamRef, {
              endorsementCategories: arrayUnion(val)
          });
      } catch (error) {
          console.error("Error adding category:", error);
          alert("Failed to save category to database");
          // Revert if failed
          setLocalCategories(prev => prev.filter(c => c !== val));
      }
  };

  // --- HANDLE REMOVE CATEGORY ---
  const handleRemoveCategory = async (catToRemove) => {
      if (!window.confirm(`Remove category "${catToRemove}"?`)) return;

      // 1. Optimistic UI Update
      setLocalCategories(prev => prev.filter(c => c !== catToRemove));
      if (category === catToRemove) setCategory('');

      // 2. Update Database
      try {
          const teamRef = doc(db, 'teams', teamId);
          await updateDoc(teamRef, {
              endorsementCategories: arrayRemove(catToRemove)
          });
      } catch (error) {
          console.error("Error removing category:", error);
          alert("Failed to remove category from database");
          // Revert if failed
          setLocalCategories(prev => [...prev, catToRemove]);
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return alert("Project title is required");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, `teams/${teamId}/handovers`), {
        title,
        category: category || 'General',
        assignees,
        parentId: parentId || null, 
        postedBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        projectTasks: [] 
      });
      
      setTitle('');
      setCategory('');
      setAssignees([]);
      onEndorsementAdded();
      onClose();
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
            {parentId ? 'Create New Sub-Project' : 'Create New Project'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title Input */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                <input 
                    type="text" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Website Redesign"
                    autoFocus
                />
            </div>

            {/* Category Selection with Add/Remove Logic */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase">Category</label>
                    <button 
                        type="button" 
                        onClick={() => setIsAddingCategory(!isAddingCategory)} 
                        className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                    >
                        {isAddingCategory ? 'Cancel' : '+ New Category'}
                    </button>
                </div>

                {isAddingCategory ? (
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newCategory} 
                            onChange={e => setNewCategory(e.target.value)} 
                            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Enter category name"
                        />
                        <button 
                            type="button" 
                            onClick={handleAddCategory} 
                            className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-700"
                        >
                            Add
                        </button>
                    </div>
                ) : (
                    <div className="relative">
                        <select 
                            value={category} 
                            onChange={e => setCategory(e.target.value)} 
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                        >
                            <option value="">Select Category</option>
                            {localCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                )}

                {/* List of categories with delete buttons */}
                {!isAddingCategory && localCategories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {localCategories.map(c => (
                            <div key={c} className="inline-flex items-center bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs border border-gray-200">
                                {c}
                                <button 
                                    type="button" 
                                    onClick={() => handleRemoveCategory(c)} 
                                    className="ml-1 text-gray-400 hover:text-red-500 p-0.5 rounded-full hover:bg-gray-200"
                                    title="Remove Category"
                                >
                                    <TrashIcon />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Assignees */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assign Members</label>
                <div className="border border-gray-300 rounded-md max-h-32 overflow-y-auto p-2 space-y-1">
                    {membersList.map(m => (
                        <label key={m.uid} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input 
                                type="checkbox" 
                                checked={assignees.includes(m.uid)}
                                onChange={e => {
                                    if(e.target.checked) setAssignees([...assignees, m.uid]);
                                    else setAssignees(assignees.filter(id => id !== m.uid));
                                }}
                                className="rounded text-blue-600"
                            />
                            {m.label}
                        </label>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-md">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 disabled:opacity-50">
                    {isSubmitting ? 'Creating...' : 'Create Project'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default AddEndorsementModal;