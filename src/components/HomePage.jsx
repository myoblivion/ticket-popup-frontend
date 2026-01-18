// src/components/HomePage.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, query, where, orderBy, doc, getDoc, onSnapshot, deleteDoc, getDocs, updateDoc, serverTimestamp 
} from "firebase/firestore";
import { auth, db } from '../firebaseConfig';
import { LanguageContext } from '../contexts/LanguageContext';

// Modals
import CreateTeamModal from './CreateTeamModal';
import NotificationsModal from './NotificationsModal';
import ConfirmationModal from './ConfirmationModal'; 

// --- Icons ---
const TrashIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const PencilIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
const FolderIcon = () => <svg className="w-10 h-10 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M2.25 6c0-1.105.895-2 2-2h4.515c.667 0 1.284.346 1.637.915l.548.885H20a2 2 0 012 2v9.75a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>;
const WrenchIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const PlusIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const UserGroupIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;

const Spinner = () => (
  <div className="flex justify-center items-center py-12">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// --- Edit Modal Component ---
const EditProjectModal = ({ isOpen, onClose, project, onSave }) => {
    const { t } = useContext(LanguageContext);
    const [teamName, setTeamName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (project) {
            setTeamName(project.teamName || '');
            setDescription(project.description || '');
        }
    }, [project]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(project.id, { teamName, description });
            onClose();
        } catch (error) {
            console.error("Error updating:", error);
            alert("Failed to update project");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !project) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">{t('common.edit', 'Edit')} Project</h3>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                            {t('common.name', 'Project Name')}
                        </label>
                        <input 
                            type="text" 
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            required 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                            {t('common.description', 'Description')}
                        </label>
                        <textarea 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                            rows="4"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50"
                        >
                            {loading ? t('common.saving', 'Saving...') : t('common.save', 'Save Changes')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Modern Team Card ---
const TeamCard = ({ team, currentUser, userRole, onDeleteTeam, onEditTeam }) => {
  const { t } = useContext(LanguageContext);

  const canManage = currentUser && (
    team.createdBy === currentUser.uid || 
    userRole === 'Master Admin' ||
    team.roles?.[currentUser.uid] === 'admin'
  );

  const memberCount = team.members?.length || 0;
  // Determine user's role in this team for the badge
  const myRole = team.roles?.[currentUser?.uid] || (team.createdBy === currentUser?.uid ? 'owner' : 'member');
  const roleColor = myRole === 'admin' || myRole === 'owner' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600';

  return (
    <div className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col h-full overflow-hidden relative">
      
      {/* Card Content Link */}
      <Link to={`/team/${team.id}`} className="flex-1 p-6 block">
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                    <span className="font-bold text-lg">{team.teamName.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1 leading-tight">
                        {team.teamName}
                    </h3>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${roleColor}`}>
                        {myRole}
                    </span>
                </div>
            </div>
        </div>

        <p className="text-sm text-slate-500 line-clamp-3 mb-6 leading-relaxed h-[60px]">
          {team.description || <span className="italic text-slate-400">{t('home.noDescription', 'No description provided.')}</span>}
        </p>

        {/* Card Footer Info */}
        <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
             <div className="flex items-center gap-1">
                 <UserGroupIcon />
                 <span>{memberCount} Member{memberCount !== 1 && 's'}</span>
             </div>
             <div>
                Created {team.createdAt?.toDate ? team.createdAt.toDate().toLocaleDateString() : 'Recently'}
             </div>
        </div>
      </Link>

      {/* Hover Actions (Absolute) */}
      {canManage && (
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
             <button 
                onClick={(e) => { e.preventDefault(); onEditTeam(team); }}
                className="p-2 bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-full shadow-sm transition-colors"
                title={t('common.edit', 'Edit')}
             >
                <PencilIcon />
             </button>
             <button 
                onClick={(e) => { e.preventDefault(); onDeleteTeam(team); }}
                className="p-2 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-full shadow-sm transition-colors"
                title={t('common.delete', 'Delete')}
             >
                <TrashIcon />
             </button>
        </div>
      )}
    </div>
  );
};

// --- Main Page ---
const HomePage = () => {
  const { t } = useContext(LanguageContext);
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); 
  const [allTeams, setAllTeams] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFixing, setIsFixing] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [parentTeamToDelete, setParentTeamToDelete] = useState(null); 
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);

  // Auth & Data Fetching (Logic remains mostly the same, just clean-up)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setAllTeams([]);
        navigate('/login', { replace: true });
        return;
      }
      
      setUser(currentUser);
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        let currentRole = null;
        if (docSnap.exists()) {
            currentRole = docSnap.data().role;
            setUserRole(currentRole);
        }

        const teamsRef = collection(db, "teams");
        let q;
        if (currentRole === 'Master Admin') {
            q = query(teamsRef, orderBy("createdAt", "desc"));
        } else {
            q = query(teamsRef, where("members", "array-contains", currentUser.uid), orderBy("createdAt", "desc"));
        }

        const unsubscribeTeams = onSnapshot(q, async (snapshot) => {
            const loadedTeams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Logic to fetch owned parents where permissions might act weird
            const myManagedParents = loadedTeams.filter(team => 
                !team.parentTeamId && (
                    team.createdBy === currentUser.uid || 
                    team.roles?.[currentUser.uid] === 'admin' ||
                    currentRole === 'Master Admin'
                )
            );

            const managedParentIds = myManagedParents.map(t => t.id);
            let extraSubProjects = [];

            // If user manages parents, fetch subs (legacy logic preserved)
            if (managedParentIds.length > 0 && currentRole !== 'Master Admin') {
                const chunks = [];
                for (let i = 0; i < managedParentIds.length; i += 10) {
                    chunks.push(managedParentIds.slice(i, i + 10));
                }
                for (const chunk of chunks) {
                    const qSubs = query(teamsRef, where("parentTeamId", "in", chunk));
                    const subSnap = await getDocs(qSubs);
                    const subs = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    extraSubProjects = [...extraSubProjects, ...subs];
                }
            }

            const finalTeams = [...loadedTeams, ...extraSubProjects].filter((team, index, self) => 
                index === self.findIndex((t) => (t.id === team.id))
            );

            finalTeams.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setAllTeams(finalTeams);
            setIsLoading(false);
        }, (err) => {
            console.error("Fetch error:", err);
            setError(t('home.loadError', 'Failed to load teams.'));
            setIsLoading(false);
        });
        return () => unsubscribeTeams();
      } catch (err) { 
          console.error(err); 
          setIsLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [navigate, t]);

  // --- Repair Function ---
  const handleRepairData = async () => {
      if(!window.confirm("Scan all teams and fix hidden projects?")) return;
      setIsFixing(true);
      try {
          const q = query(collection(db, "teams"));
          const snapshot = await getDocs(q);
          let fixedCount = 0;
          const updates = snapshot.docs.map(async (docSnap) => {
              const data = docSnap.data();
              const members = data.members || [];
              const isCorrupted = members.some(m => typeof m === 'object');
              if (isCorrupted) {
                  const fixedMembers = [];
                  const restoredRoles = data.roles || {};
                  members.forEach(m => {
                      if (typeof m === 'object' && m.uid) {
                          fixedMembers.push(m.uid);
                          if (m.role) restoredRoles[m.uid] = m.role;
                      } else if (typeof m === 'string') {
                          fixedMembers.push(m);
                      }
                  });
                  await updateDoc(doc(db, "teams", docSnap.id), { members: fixedMembers, roles: restoredRoles });
                  fixedCount++;
              }
          });
          await Promise.all(updates);
          alert(`Fixed ${fixedCount} teams.`);
      } catch (err) {
          console.error("Repair failed", err);
          alert("Repair failed.");
      } finally {
          setIsFixing(false);
      }
  };

  const handleOpenDeleteParentModal = (team) => { setParentTeamToDelete(team); setDeleteModalOpen(true); }
  const handleOpenEditModal = (project) => { setProjectToEdit(project); setIsEditModalOpen(true); };
  
  const handleUpdateProject = async (projectId, updates) => {
    const docRef = doc(db, "teams", projectId);
    await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
  };

  const handleConfirmDelete = async () => {
    try {
        if (parentTeamToDelete) { await deleteDoc(doc(db, "teams", parentTeamToDelete.id)); }
        setDeleteModalOpen(false);
        setParentTeamToDelete(null);
    } catch (error) {
        console.error("Error deleting:", error);
        alert(t('common.deleteError', 'Failed to delete.'));
    }
  };

  const parentTeams = allTeams.filter(team => !team.parentTeamId);
  const handleRefresh = () => { };

  return (
    <>
      <div className="min-h-screen bg-slate-50/50">
        
        {/* --- Header Section --- */}
        <div className="bg-white border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            Welcome back, {user?.displayName || 'User'} 👋
                        </h1>
                        <p className="text-slate-500 mt-1">
                            Here is an overview of your active projects.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Repair Tool (Secondary) */}
                        <button 
                            onClick={handleRepairData} 
                            disabled={isFixing}
                            className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200"
                            title="Repair corrupted data"
                        >
                            {isFixing ? <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div> : <WrenchIcon />}
                            <span className="hidden lg:inline">Fix Data</span>
                        </button>

                        {/* Create Button (Primary) */}
                        <button 
                            onClick={() => setIsCreateModalOpen(true)} 
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 px-6 rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transform active:scale-95 transition-all"
                        >
                            <PlusIcon />
                            {t('home.createMainProject', 'New Project')}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* --- Content Section --- */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {isLoading && <Spinner />}
            
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center shadow-sm">
                    {error}
                </div>
            )}
            
            {!isLoading && !error && (
                <>
                    {parentTeams.length === 0 ? (
                        /* Empty State */
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                            <div className="p-4 bg-blue-50 rounded-full mb-4">
                                <FolderIcon />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">No Projects Found</h3>
                            <p className="text-slate-500 text-center max-w-sm mb-6">
                                {t('home.noTeams', "You haven't joined any projects yet. Create one to get started.")}
                            </p>
                            <button 
                                onClick={() => setIsCreateModalOpen(true)} 
                                className="text-blue-600 font-bold hover:text-blue-700 hover:underline flex items-center gap-1"
                            >
                                Create your first project &rarr;
                            </button>
                        </div>
                    ) : (
                        /* Grid Layout */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {parentTeams.map((parent) => (
                                <TeamCard 
                                    key={parent.id} 
                                    team={parent} 
                                    currentUser={user} 
                                    userRole={userRole} 
                                    onDeleteTeam={handleOpenDeleteParentModal}
                                    onEditTeam={handleOpenEditModal}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </main>
      </div>

      <CreateTeamModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onTeamCreated={handleRefresh} />
      <EditProjectModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} project={projectToEdit} onSave={handleUpdateProject} />
      <NotificationsModal isOpen={isNotificationsModalOpen} onClose={() => setIsNotificationsModalOpen(false)} />
      <ConfirmationModal 
          isOpen={deleteModalOpen} 
          onClose={() => setDeleteModalOpen(false)} 
          onConfirm={handleConfirmDelete} 
          title={t('common.confirmDeleteTeam', 'Delete this team?')} 
          message={`${t('home.deleteSubConfirmPre', 'Delete')} "${parentTeamToDelete?.teamName}"?`} 
          isDeleting={true} 
      />
    </>
  );
};

export default HomePage;