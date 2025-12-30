// src/components/EndorsementModal.jsx
import React, { useState, useEffect, useContext } from 'react';
import { db } from '../firebaseConfig';
import {
  collection, query, orderBy, doc, onSnapshot, where, getDoc, updateDoc
} from 'firebase/firestore';
import HandoverPopup from './HandoverPopup';
import CreateTaskModal from './CreateTaskModal';
import { LanguageContext } from '../contexts/LanguageContext';

// --- ICONS ---
const PencilIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const PlusIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const UserGroupIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const XIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

// --- Manage Project Members Modal ---
const ManageProjectMembersModal = ({ isOpen, onClose, currentMembers = [], allMembers = [], onSave, isSaving }) => {
    const [selected, setSelected] = useState([]);
    useEffect(() => { if (isOpen) setSelected(currentMembers || []); }, [isOpen, currentMembers]);
    if (!isOpen) return null;
    const toggleMember = (uid) => setSelected(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-gray-800">Manage Project Members</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 max-h-80">
                    <div className="space-y-1">
                        {allMembers.map(m => {
                            const isSelected = selected.includes(m.uid);
                            return (
                                <label key={m.uid} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:bg-gray-50'}`}>
                                    <input type="checkbox" checked={isSelected} onChange={() => toggleMember(m.uid)} className="rounded text-blue-600 focus:ring-blue-500" />
                                    <div className="flex-1"><p className={`text-sm font-medium ${isSelected ? 'text-blue-800' : 'text-gray-700'}`}>{m.displayName || m.email}</p></div>
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-white rounded-lg">Cancel</button>
                    <button onClick={() => onSave(selected)} disabled={isSaving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Changes'}</button>
                </div>
            </div>
        </div>
    );
};

const HandoversSection = ({ teamId, membersDetails = [], isTeamCreator, currentUserUid, selectedProjectId }) => {
  const { t } = useContext(LanguageContext);
  const [tasks, setTasks] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);

  // --- FILTER STATES ---
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTaskContext, setSelectedTaskContext] = useState(null); 
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isManageMembersModalOpen, setIsManageMembersModalOpen] = useState(false);
  const [isSavingMembers, setIsSavingMembers] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);

  const resolveName = (uid) => {
    if (!uid) return 'Unknown';
    const member = membersDetails.find(m => m.uid === uid);
    return member ? (member.displayName || member.email) : 'Unknown';
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // --- FETCH LOGIC ---
  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    setTasks([]);
    setCurrentProject(null);

    let unsub;

    if (selectedProjectId && selectedProjectId !== 'my_tasks') {
        const docRef = doc(db, `teams/${teamId}/handovers`, selectedProjectId);
        unsub = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setCurrentProject({ id: docSnap.id, ...data });
                const rawTasks = data.projectTasks || [];
                const mapped = rawTasks.map(task => ({
                    ...task,
                    projectId: docSnap.id,
                    projectTitle: data.title,
                    category: data.category,
                    projectCreator: data.postedBy 
                }));
                setTasks(mapped);
            } else { setTasks([]); setCurrentProject(null); }
            setLoading(false);
        });
    } else {
        const q = query(collection(db, `teams/${teamId}/handovers`), orderBy('createdAt', 'desc'));
        unsub = onSnapshot(q, (snapshot) => {
            let allTasks = [];
            snapshot.docs.forEach(doc => {
                const d = doc.data();
                const pTasks = d.projectTasks || [];
                const mapped = pTasks.map(task => ({
                    ...task,
                    projectId: doc.id,
                    projectTitle: d.title,
                    category: d.category,
                    projectCreator: d.postedBy
                }));
                allTasks = [...allTasks, ...mapped];
            });
            // If "My Tasks", filter. If "All Tasks", show everything regardless of assignment.
            if (selectedProjectId === 'my_tasks') {
                allTasks = allTasks.filter(t => Array.isArray(t.assignedTo) && t.assignedTo.includes(currentUserUid));
            }
            setTasks(allTasks);
            setLoading(false);
        });
    }
    return () => { if(unsub) unsub(); };
  }, [teamId, selectedProjectId, currentUserUid]);

  useEffect(() => {
    if (!teamId) return;
    const q = query(collection(db, `teams/${teamId}/workLogs`), where('status', '==', 'active'));
    const unsub = onSnapshot(q, (snap) => setActiveSessions(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    return () => unsub();
  }, [teamId]);

  // --- ACTIONS ---
  const handleSaveProjectMembers = async (newMembers) => {
      if (!currentProject) return;
      setIsSavingMembers(true);
      try {
          const docRef = doc(db, `teams/${teamId}/handovers`, currentProject.id);
          await updateDoc(docRef, { assignees: newMembers });
          setIsManageMembersModalOpen(false);
      } catch (err) { alert("Failed to update project members."); } finally { setIsSavingMembers(false); }
  };

  const handleDeleteTask = async (e, task) => {
      e.stopPropagation();
      if (!window.confirm(`Are you sure you want to delete task: "${task.title}"?`)) return;
      try {
          const projectRef = doc(db, `teams/${teamId}/handovers`, task.projectId);
          const snap = await getDoc(projectRef);
          if (snap.exists()) {
              const currentTasks = snap.data().projectTasks || [];
              const updatedTasks = currentTasks.filter(t => t.id !== task.id);
              await updateDoc(projectRef, { projectTasks: updatedTasks });
          }
      } catch (err) { console.error(err); }
  };

  const handleEditTask = (e, task) => {
      e.stopPropagation();
      setTaskToEdit(task);
      setIsCreateTaskModalOpen(true);
  };

  const openCreateModal = () => {
      if (!selectedProjectId || selectedProjectId === 'my_tasks') {
          alert("Please select a specific Project from the sidebar first to add a task.");
          return;
      }
      setTaskToEdit(null);
      setIsCreateTaskModalOpen(true);
  };

  const filteredTasks = tasks.filter(task => {
      if (filterStatus && task.status !== filterStatus) return false;
      if (filterPriority && task.priority !== filterPriority) return false;
      if (filterAssignee) {
          if (!Array.isArray(task.assignedTo)) return false;
          if (!task.assignedTo.includes(filterAssignee)) return false;
      }
      if (searchQuery) {
          const lowerQ = searchQuery.toLowerCase();
          const matchTitle = (task.title || '').toLowerCase().includes(lowerQ);
          const matchDesc = (task.description || '').toLowerCase().includes(lowerQ);
          const matchProj = (task.projectTitle || '').toLowerCase().includes(lowerQ);
          if (!matchTitle && !matchProj && !matchDesc) return false;
      }
      return true;
  });

  const getStatusColor = (s) => {
      switch(s) {
          case 'Completed': return 'bg-green-100 text-green-800 border-green-200';
          case 'QA': return 'bg-purple-100 text-purple-800 border-purple-200';
          case 'Revision': return 'bg-orange-100 text-orange-800 border-orange-200';
          case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
          default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg">
      <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center bg-gray-50/50 rounded-t-lg">
          <div className="flex-1 min-w-[200px]"><input type="text" placeholder="Search tasks, descriptions..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"><option value="">All Statuses</option><option value="Open">Open</option><option value="In Progress">In Progress</option><option value="QA">QA</option><option value="Revision">Revision</option><option value="Completed">Completed</option></select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"><option value="">All Priorities</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select>
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"><option value="">All Assignees</option>{membersDetails.map(m => <option key={m.uid} value={m.uid}>{m.displayName || m.email}</option>)}</select>
          
          <div className="flex items-center gap-2 border-l pl-3 ml-2 border-gray-300">
              {selectedProjectId && selectedProjectId !== 'my_tasks' && isTeamCreator && (
                  <button onClick={() => setIsManageMembersModalOpen(true)} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-gray-50 transition shadow-sm" title="Manage Project Members"><UserGroupIcon /><span className="hidden sm:inline">Members</span></button>
              )}
              {selectedProjectId && selectedProjectId !== 'my_tasks' && (
                  <button onClick={openCreateModal} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-bold hover:bg-blue-700 transition shadow-sm"><PlusIcon /> New Task</button>
              )}
          </div>
      </div>

      <div className="flex-1 overflow-auto p-0">
        <table className="min-w-full divide-y divide-gray-200">
           <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
             <tr>
               <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-12">No</th>
               <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
               <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Subject</th>
               <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/4">Description</th>
               <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
               <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Priority</th>
               <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Worker</th>
               <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Created</th>
               <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
             </tr>
           </thead>
           <tbody className="bg-white divide-y divide-gray-200 text-sm">
             {loading ? <tr><td colSpan="9" className="py-10 text-center"><div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div></td></tr> : filteredTasks.length === 0 ? <tr><td colSpan="9" className="text-center py-10 text-gray-400 italic">No tasks found. Select a project and click New Task.</td></tr> : (
                 filteredTasks.map((task, idx) => {
                     const isActive = activeSessions.some(s => s.taskId === task.id && s.status === 'active');
                     // PERMISSION CHECK: Only Team Creator (Admin) OR Task Creator can edit/delete
                     const canEdit = isTeamCreator || (task.createdBy && task.createdBy === currentUserUid);

                     return (
                         <tr key={`${task.id}-${idx}`} onClick={() => { setSelectedTaskContext({ handoverId: task.projectId, taskId: task.id }); setIsDetailsModalOpen(true); }} className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${isActive ? 'bg-green-50' : ''}`}>
                             <td className="px-6 py-4 text-gray-500 text-xs">{idx + 1}</td>
                             <td className="px-6 py-4"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{task.category || 'General'}</span></td>
                             <td className="px-6 py-4">
                                 <div className="flex flex-col">
                                     <div className="flex items-center gap-2">
                                         {isActive && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
                                         <span className="font-bold text-gray-800">{task.title}</span>
                                     </div>
                                     <span className="text-[10px] text-gray-400 mt-1">Project: {task.projectTitle}</span>
                                 </div>
                             </td>
                             <td className="px-6 py-4"><span className="text-xs text-gray-500 line-clamp-2" title={task.description}>{task.description || '-'}</span></td>
                             <td className="px-6 py-4"><span className={`px-2 py-1 rounded border text-xs font-bold uppercase ${getStatusColor(task.status)}`}>{task.status || 'Open'}</span></td>
                             <td className="px-6 py-4"><span className={`text-xs font-bold ${task.priority === 'High' ? 'text-red-600' : task.priority === 'Low' ? 'text-gray-500' : 'text-blue-600'}`}>{task.priority || 'Medium'}</span></td>
                             <td className="px-6 py-4">{Array.isArray(task.assignedTo) && task.assignedTo.length > 0 ? <div className="flex flex-col text-xs text-gray-700">{task.assignedTo.map(uid => <span key={uid} className="truncate max-w-[150px]" title={resolveName(uid)}>{resolveName(uid)}</span>)}</div> : <span className="text-xs text-gray-400 italic">Unassigned</span>}</td>
                             <td className="px-6 py-4"><div className="flex flex-col text-xs"><span className="text-gray-600">{formatDate(task.createdAt)}</span></div></td>
                             <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-3 min-h-[20px]">
                                    {canEdit && (
                                        <>
                                            <button onClick={(e) => handleEditTask(e, task)} className="text-gray-400 hover:text-blue-600"><PencilIcon /></button>
                                            <button onClick={(e) => handleDeleteTask(e, task)} className="text-gray-400 hover:text-red-600"><TrashIcon /></button>
                                        </>
                                    )}
                                </div>
                             </td>
                         </tr>
                     )
                 })
             )}
           </tbody>
        </table>
      </div>

      <CreateTaskModal 
         isOpen={isCreateTaskModalOpen} 
         onClose={() => { setIsCreateTaskModalOpen(false); setTaskToEdit(null); }} 
         teamId={teamId}
         projectId={selectedProjectId || (taskToEdit ? taskToEdit.projectId : null)} 
         membersDetails={membersDetails}
         taskToEdit={taskToEdit} 
      />

      {isDetailsModalOpen && selectedTaskContext && (
        <HandoverPopup
          teamId={teamId}
          handoverId={selectedTaskContext.handoverId} 
          taskId={selectedTaskContext.taskId}         
          onClose={() => { setSelectedTaskContext(null); setIsDetailsModalOpen(false); }}
          membersDetails={membersDetails}
          currentUserUid={currentUserUid}
        />
      )}

      <ManageProjectMembersModal
          isOpen={isManageMembersModalOpen}
          onClose={() => setIsManageMembersModalOpen(false)}
          currentMembers={currentProject?.assignees || []}
          allMembers={membersDetails}
          onSave={handleSaveProjectMembers}
          isSaving={isSavingMembers}
      />
    </div>
  );
};

export default HandoversSection;