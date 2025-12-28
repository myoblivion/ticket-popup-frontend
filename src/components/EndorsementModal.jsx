import React, { useState, useEffect, useContext } from 'react';
import { db } from '../firebaseConfig';

import {
  collection,
  query,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  where // <--- Added this
} from 'firebase/firestore';

import AddEndorsementModal from './AddEndorsementModal';
import HandoverPopup from './HandoverPopup';
import { LanguageContext } from '../contexts/LanguageContext';

// --- Placeholders ---
const DEFAULT_PLACEHOLDERS = {
  categories: ['General', 'Tech', 'Operations'],
};

// ... [OptionsEditorModal remains exactly the same, keeping it collapsed to save space] ...
const OptionsEditorModal = ({ 
  isOpen, onClose, teamId, t, 
  categoriesList, persistTeamArrayField
}) => {
  if (!isOpen) return null;
  const [newCat, setNewCat] = useState('');
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">Manage Categories</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">&times;</button>
        </div>
        <div className="p-6">
           <h4 className="font-semibold mb-2 text-sm text-gray-700">Project Categories</h4>
           <div className="flex gap-2 mb-4">
             <input value={newCat} onChange={e => setNewCat(e.target.value)} className="border rounded px-3 py-2 flex-1 text-sm" placeholder="New Category..." />
             <button onClick={() => { if(newCat.trim()) { persistTeamArrayField('endorsementCategories', newCat, 'add'); setNewCat(''); } }} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Add</button>
           </div>
           <div className="flex flex-wrap gap-2">
             {categoriesList.map(cat => (
               <span key={cat} className="bg-gray-100 border px-3 py-1 rounded-full text-sm flex items-center gap-2">
                 {cat}
                 <button onClick={() => persistTeamArrayField('endorsementCategories', cat, 'remove')} className="text-red-500 hover:text-red-700">&times;</button>
               </span>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};


/* ------------------------------------------------------------------
   Main HandoversSection Component
   ------------------------------------------------------------------ */
const HandoversSection = ({ teamId, membersDetails = [], isTeamCreator, currentUserUid }) => {
  const { t } = useContext(LanguageContext);
  const [handovers, setHandovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- NEW STATE: Active Work Logs ---
  const [activeSessions, setActiveSessions] = useState([]); 

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedHandover, setSelectedHandover] = useState(null);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);

  // Options State
  const [categoriesList, setCategoriesList] = useState(DEFAULT_PLACEHOLDERS.categories);
   
  const membersListForModal = membersDetails.map(m => {
      if (typeof m === 'object') {
          return { uid: m.uid, label: m.displayName || m.email || m.uid };
      }
      return { uid: m, label: 'Unknown' };
  });

  const resolveName = (uidOrName) => {
    if (!uidOrName) return 'Unknown';
    if (uidOrName.length > 20) {
       const member = membersDetails.find(m => m.uid === uidOrName);
       if (member) return member.displayName || member.email;
    }
    return uidOrName;
  };

  // Fetch Team Data
  useEffect(() => {
    if (!teamId) return;
    const teamRef = doc(db, 'teams', teamId);
    const unsubTeam = onSnapshot(teamRef, (docSnap) => {
       if (docSnap.exists()) {
         const data = docSnap.data();
         if (data.endorsementCategories) setCategoriesList(data.endorsementCategories);
       }
    });
    return () => unsubTeam();
  }, [teamId]);

  // Fetch Projects
  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    
    const q = query(collection(db, `teams/${teamId}/handovers`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHandovers(fetched);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching projects:", err);
      setError(t('endorsement.errorLoading', 'Failed to load projects.'));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamId, t]);

  // --- NEW EFFECT: Listen for Active Work Logs ---
  useEffect(() => {
    if (!teamId) return;

    // Listen to ALL active logs for this team
    const q = query(
      collection(db, `teams/${teamId}/workLogs`), 
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const active = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveSessions(active);
    }, (err) => {
      console.error("Error fetching active logs:", err);
    });

    return () => unsubscribe();
  }, [teamId]);


  const handleHandoverAdded = () => {
    setIsAddModalOpen(false);
  };

  const persistTeamArrayField = async (field, value, action) => {
      const teamRef = doc(db, 'teams', teamId);
      try {
          if (action === 'add') {
              await updateDoc(teamRef, { [field]: arrayUnion(value) });
          } else if (action === 'remove') {
              await updateDoc(teamRef, { [field]: arrayRemove(value) });
          }
      } catch (err) {
          console.error(`Error updating ${field}:`, err);
      }
  };

  const openDetailsModal = (handover) => {
    setSelectedHandover(handover);
    setIsDetailsModalOpen(true);
  };
   
  const closeDetailsModal = () => {
    setSelectedHandover(null);
    setIsDetailsModalOpen(false);
  };
   
  const handleDelete = async (e, id) => {
      e.stopPropagation();
      if (!window.confirm(t('common.confirmDelete'))) return;
      try {
          await deleteDoc(doc(db, `teams/${teamId}/handovers`, id));
      } catch (err) {
          console.error("Error deleting project:", err);
      }
  };

  const filteredHandovers = handovers.filter(item => {
      if (isTeamCreator) return true;
      if (item.assignees && item.assignees.includes(currentUserUid)) return true;
      return false;
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
      {/* Header Actions */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center gap-2">
           <h2 className="text-lg font-bold text-gray-800">Projects</h2>
           {isTeamCreator && (
             <button onClick={() => setIsOptionsModalOpen(true)} className="text-gray-400 hover:text-blue-600 text-xs underline ml-2">
               Manage Categories
             </button>
           )}
        </div>
        
        {isTeamCreator && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t('endorsement.add', 'New Project')}
            </button>
        )}
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && <div className="text-center py-10 text-gray-500">Loading...</div>}
        {error && <div className="text-center py-10 text-red-500">{error}</div>}
        
        {!loading && !error && filteredHandovers.length === 0 && (
          <div className="text-center py-10 text-gray-400 italic">
            {isTeamCreator ? t('endorsement.noData', 'No projects found.') : "No projects assigned to you."}
          </div>
        )}

        {!loading && !error && filteredHandovers.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
             <table className="min-w-full divide-y divide-gray-200">
               <thead className="bg-gray-50">
                 <tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">Project Details</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                 </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                 {filteredHandovers.map((item) => {
                    // Check if anyone is working on THIS project
                    const projectActiveSessions = activeSessions.filter(s => s.handoverId === item.id);
                    const isProjectActive = projectActiveSessions.length > 0;

                   return (
                   <tr key={item.id} className={`hover:bg-gray-50 transition-colors cursor-pointer ${isProjectActive ? 'bg-green-50/30' : ''}`} onClick={() => openDetailsModal(item)}>
                     
                     <td className="px-6 py-4">
                       <div className="flex flex-col">
                         <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">{item.title || 'Untitled'}</span>
                            {/* LIVE BADGE if anyone is working */}
                            {isProjectActive && (
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                            )}
                         </div>
                         
                         {item.category && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full w-fit mt-1">{item.category}</span>}
                         <span className="text-xs text-gray-600 mt-2 line-clamp-1">{item.description}</span>
                         
                         {item.assignees && item.assignees.length > 0 && (
                             <div className="flex -space-x-1 overflow-hidden mt-2">
                               {item.assignees.map((uid) => {
                                 const name = resolveName(uid);
                                 
                                 // Check if THIS specific user is working on THIS project
                                 const userActiveSession = projectActiveSessions.find(s => s.userId === uid);
                                 const isUserWorking = !!userActiveSession;

                                 return (
                                   <div 
                                      key={uid} 
                                      className={`
                                        relative inline-block w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden transition-all
                                        ${isUserWorking 
                                            ? 'bg-white text-green-700 ring-2 ring-green-500 ring-offset-1 z-10' // Active styling
                                            : 'bg-blue-100 text-blue-800 ring-1 ring-white' // Normal styling
                                        }
                                      `} 
                                      title={isUserWorking ? `Working on: ${userActiveSession.taskTitle}` : name}
                                   >
                                     {name.charAt(0).toUpperCase()}
                                     {/* Pulse effect for user avatar */}
                                     {isUserWorking && (
                                         <span className="absolute inset-0 rounded-full animate-pulse bg-green-400/20"></span>
                                     )}
                                   </div>
                                 );
                               })}
                             </div>
                         )}
                         <div className="text-xs text-gray-400 mt-2">
                           Created by: {resolveName(item.postedBy)}
                         </div>
                       </div>
                     </td>
                     

                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col items-start gap-1">
                           <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                             ${item.status === 'Completed' ? 'bg-blue-100 text-blue-800' : 
                               item.status === 'Working' ? 'bg-green-100 text-green-800' :
                               'bg-gray-100 text-gray-800' }`}>
                             {item.status || 'Not Started'}
                           </span>
                           {isProjectActive && (
                               <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                   <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                   Active Now
                               </span>
                           )}
                           <div className="text-xs text-gray-500">{item.priority || 'Medium'} Priority</div>
                       </div>
                     </td>

                     <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                       {isTeamCreator && (
                           <button onClick={(e) => handleDelete(e, item.id)} className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded hover:bg-red-100">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                       )}
                     </td>
                   </tr>
                 )})}
               </tbody>
             </table>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
<AddEndorsementModal
  isOpen={isAddModalOpen}
  onClose={() => setIsAddModalOpen(false)}
  teamId={teamId}
  onEndorsementAdded={handleHandoverAdded}
  t={t}
  categoriesList={categoriesList}
  membersList={membersListForModal}
  manageCategories={() => setIsOptionsModalOpen(true)} // <--- ADD THIS LINE
/>

      {isDetailsModalOpen && selectedHandover && (
        <HandoverPopup
          teamId={teamId}
          handoverId={selectedHandover.id}
          columnKey="details"
          onClose={closeDetailsModal}
          membersDetails={membersDetails}
          currentUserUid={currentUserUid}
        />
      )}
      
      {isOptionsModalOpen && (
        <OptionsEditorModal
          isOpen={isOptionsModalOpen}
          onClose={() => setIsOptionsModalOpen(false)}
          teamId={teamId}
          t={t}
          categoriesList={categoriesList}
          persistTeamArrayField={persistTeamArrayField}
        />
      )}
    </div>
  );
};

export default HandoversSection;