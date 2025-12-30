// src/components/CreateTaskModal.jsx
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';

// --- Icons ---
const PaperClipIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>;
const LinkIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;
const UserAddIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>;
const XIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

const CreateTaskModal = ({ isOpen, onClose, teamId, projectId, membersDetails = [], taskToEdit = null }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [assignees, setAssignees] = useState([]);
  
  const [images, setImages] = useState([]); 
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [linkInput, setLinkInput] = useState('');
  
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
      if (isOpen) {
          if (taskToEdit) {
              setTitle(taskToEdit.title || '');
              setDescription(taskToEdit.description || '');
              setPriority(taskToEdit.priority || 'Medium');
              setAssignees(taskToEdit.assignedTo || []);
              setImages(taskToEdit.images || []);
              setFiles(taskToEdit.files || []);
              setLinks(taskToEdit.links || []);
          } else {
              setTitle('');
              setDescription('');
              setPriority('Medium');
              setAssignees([]);
              setImages([]);
              setFiles([]);
              setLinks([]);
          }
      }
  }, [isOpen, taskToEdit]);

  if (!isOpen) return null;

  const processPaste = (e) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
              const blob = items[i].getAsFile();
              const reader = new FileReader();
              reader.onload = (evt) => setImages(prev => [...prev, evt.target.result]);
              reader.readAsDataURL(blob);
          }
      }
  };

  const handleFileUpload = (e) => {
      const selected = Array.from(e.target.files);
      selected.forEach(file => {
          const reader = new FileReader();
          reader.onload = (evt) => {
              setFiles(prev => [...prev, { name: file.name, data: evt.target.result, type: file.type }]);
          };
          reader.readAsDataURL(file);
      });
  };

  const handleAddLink = () => {
      if (linkInput.trim()) {
          setLinks(prev => [...prev, linkInput.trim()]);
          setLinkInput('');
      }
  };

  const toggleAssignee = (uid) => {
      setAssignees(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      const targetProjectId = taskToEdit?.projectId || projectId;

      if (!title.trim() || !targetProjectId) {
          alert("Title is required and a Project must be identified.");
          return;
      }
      setIsSubmitting(true);

      const taskData = {
          title,
          description,
          priority,
          assignedTo: assignees,
          images,
          files,
          links,
          updatedAt: new Date().toISOString()
      };

      try {
          const projectRef = doc(db, 'teams', teamId, 'handovers', targetProjectId);

          if (taskToEdit) {
              const projectSnap = await getDoc(projectRef);
              if (projectSnap.exists()) {
                  const currentTasks = projectSnap.data().projectTasks || [];
                  const updatedTasks = currentTasks.map(t => {
                      if (t.id === taskToEdit.id) {
                          return { ...t, ...taskData };
                      }
                      return t;
                  });
                  await updateDoc(projectRef, { projectTasks: updatedTasks });
              }
          } else {
              // Create New Task
              const newTask = {
                  id: Date.now().toString(),
                  status: 'Open',
                  createdAt: new Date().toISOString(),
                  createdBy: auth.currentUser?.uid, // IMPORTANT: Save Creator ID
                  ...taskData
              };
              await updateDoc(projectRef, { projectTasks: arrayUnion(newTask) });
          }

          onClose();
      } catch (err) {
          console.error("Error saving task:", err);
          alert("Failed to save task");
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b">
             <h2 className="text-xl font-bold text-gray-800">{taskToEdit ? 'Edit Task' : 'Create New Task'}</h2>
             <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <form id="task-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Task Name</label>
                        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Task Title" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Priority</label>
                        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" value={priority} onChange={e => setPriority(e.target.value)}>
                            <option value="High">High Priority</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Description</label>
                    <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-48 bg-gray-50 placeholder-gray-400" placeholder="Detailed description..." value={description} onChange={e => setDescription(e.target.value)} onPaste={processPaste} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase flex items-center gap-1"><PaperClipIcon /> Upload Files</label>
                        <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-white transition">
                            <span className="text-[10px] text-gray-500">Click to upload</span>
                            <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                        </label>
                        <div className="flex flex-wrap gap-2 mt-2">
                             {images.map((img, i) => <div key={i} className="relative w-10 h-10 border rounded overflow-hidden"><img src={img} className="w-full h-full object-cover" /><button type="button" onClick={() => setImages(p => p.filter((_,x)=>x!==i))} className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 hover:opacity-100 text-xs">x</button></div>)}
                             {files.map((f, i) => <div key={i} className="flex items-center bg-white px-2 py-1 rounded border text-[10px] gap-2"><span className="truncate max-w-[60px]">{f.name}</span><button type="button" onClick={() => setFiles(p => p.filter((_,x)=>x!==i))} className="text-red-500 font-bold">x</button></div>)}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase flex items-center gap-1"><LinkIcon /> External Links</label>
                        <div className="flex gap-2 mb-2"><input className="flex-1 border rounded text-xs px-2 py-1" placeholder="https://" value={linkInput} onChange={e => setLinkInput(e.target.value)} /><button type="button" onClick={handleAddLink} className="bg-gray-200 px-3 py-1 rounded text-xs font-bold hover:bg-gray-300">Add</button></div>
                        <div className="space-y-1 max-h-20 overflow-y-auto">{links.map((l, i) => <div key={i} className="flex justify-between items-center text-[10px] bg-white px-2 py-1 rounded border"><span className="truncate flex-1 text-blue-600">{l}</span><button type="button" onClick={() => setLinks(p => p.filter((_,x)=>x!==i))} className="text-red-500 ml-2">x</button></div>)}</div>
                    </div>
                </div>
                <div className="relative">
                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase flex items-center gap-1"><UserAddIcon /> Assign To</label>
                    <div className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm cursor-pointer hover:border-blue-400 bg-white flex items-center justify-between" onClick={() => setIsAssigneeOpen(!isAssigneeOpen)}>
                        <span className={assignees.length ? 'text-gray-800 font-medium' : 'text-gray-400'}>{assignees.length === 0 ? 'Select Team Members' : `${assignees.length} members selected`}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                    {isAssigneeOpen && (
                        <div className="absolute z-10 top-full left-0 w-full bg-white border border-gray-200 shadow-xl rounded-lg mt-1 max-h-48 overflow-y-auto">
                            {membersDetails.map(m => (
                                <label key={m.uid} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors">
                                    <input type="checkbox" checked={assignees.includes(m.uid)} onChange={() => toggleAssignee(m.uid)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                                    <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] text-blue-700 font-bold">{(m.displayName || m.email)[0].toUpperCase()}</div><span className="text-sm text-gray-700">{m.displayName || m.email}</span></div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </form>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
             <button onClick={onClose} className="px-5 py-2 text-sm text-gray-600 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 font-medium transition-all">Cancel</button>
             <button type="submit" form="task-form" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/30 disabled:opacity-50">{isSubmitting ? 'Saving...' : (taskToEdit ? 'Save Changes' : 'Create Task')}</button>
        </div>
      </div>
    </div>
  );
};

export default CreateTaskModal;