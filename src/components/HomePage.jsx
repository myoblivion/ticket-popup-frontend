// HomePage.jsx
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
import CreateSubTeamModal from './CreateSubTeamModal'; // Kept in imports in case needed later, but unused in UI now
import NotificationsModal from './NotificationsModal';
import ConfirmationModal from './ConfirmationModal'; 

// --- Icons ---
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const PencilIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
const FolderIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;

const Spinner = () => (
  <div className="flex justify-center items-center py-6">
    <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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
            const updates = {
                teamName,
                description 
            };
            await onSave(project.id, updates);
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-4 text-gray-800">
                    {t('common.edit', 'Edit')} Project
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('common.name', 'Project Name')}
                        </label>
                        <input 
                            type="text" 
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                            required 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('common.description', 'Description')}
                        </label>
                        <textarea 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                            rows="3"
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {loading ? t('common.saving', 'Saving...') : t('common.save', 'Save Changes')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- TeamCard Component (Re-designed) ---
const TeamCard = ({ 
    team, 
    currentUser, 
    userRole, 
    onDeleteTeam,
    onEditTeam 
}) => {
  const { t } = useContext(LanguageContext);

  const canManage = currentUser && (
    team.createdBy === currentUser.uid || 
    userRole === 'Master Admin' ||
    team.roles?.[currentUser.uid] === 'admin'
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 flex flex-col h-full overflow-hidden group relative">
      <div className="p-6 flex flex-col h-full">
        
        {/* Header: Icon + Actions */}
        <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
                <FolderIcon />
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                {canManage && (
                    <>
                        <button 
                            onClick={(e) => {
                                e.preventDefault(); e.stopPropagation(); onEditTeam(team);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title={t('common.edit', 'Edit Team')}
                        >
                            <PencilIcon />
                        </button>
                        <button 
                            onClick={(e) => {
                                e.preventDefault(); e.stopPropagation(); onDeleteTeam(team);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title={t('common.delete', 'Delete Team')}
                        >
                            <TrashIcon />
                        </button>
                    </>
                )}
            </div>
        </div>

        {/* Content */}
        <Link to={`/team/${team.id}`} className="block flex-1">
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2 line-clamp-1" title={team.teamName}>
                {team.teamName}
            </h3>
            <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed">
                {team.description || t('home.noDescription', 'No description provided.')}
            </p>
        </Link>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>
                {team.members?.length || 0} Member{team.members?.length !== 1 && 's'}
            </span>
            <Link to={`/team/${team.id}`} className="text-blue-600 font-medium hover:underline">
                Open Project &rarr;
            </Link>
        </div>
      </div>
    </div>
  );
};

// --- Main HomePage Component ---
const HomePage = () => {
  const { t } = useContext(LanguageContext);
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); 
  const [allTeams, setAllTeams] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  
  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [parentTeamToDelete, setParentTeamToDelete] = useState(null); 
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);

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
            // Standard User: Get teams where they are explicitly a member
            q = query(teamsRef, where("members", "array-contains", currentUser.uid), orderBy("createdAt", "desc"));
        }

        const unsubscribeTeams = onSnapshot(q, async (snapshot) => {
            const loadedTeams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // --- Logic to ensure we get necessary data ---
            // Even though we hide sub-projects on the homepage UI, we keep the robust fetching logic
            // in case the user role logic relies on parent/child relationships for permissions.
            const myManagedParents = loadedTeams.filter(team => 
                !team.parentTeamId && (
                    team.createdBy === currentUser.uid || 
                    team.roles?.[currentUser.uid] === 'admin' ||
                    currentRole === 'Master Admin'
                )
            );

            const managedParentIds = myManagedParents.map(t => t.id);
            let extraSubProjects = [];

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

            // Merge and Remove Duplicates
            const finalTeams = [...loadedTeams, ...extraSubProjects].filter((team, index, self) => 
                index === self.findIndex((t) => (t.id === team.id))
            );

            // Sort
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

  // Handlers
  const handleOpenDeleteParentModal = (team) => {
    setParentTeamToDelete(team);
    setDeleteModalOpen(true);
  }

  const handleOpenEditModal = (project) => {
    setProjectToEdit(project);
    setIsEditModalOpen(true);
  };

  const handleUpdateProject = async (projectId, updates) => {
    try {
        const docRef = doc(db, "teams", projectId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    } catch (err) {
        console.error("Error updating project:", err);
        throw err; // Re-throw to be caught in modal
    }
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

  // Filter only Main Projects (Parent Teams) for display
  const parentTeams = allTeams.filter(team => !team.parentTeamId);

  const handleRefresh = () => { /* snapshot listener handles updates */ };

  return (
    <>
      {/* UPDATED: Changed max-w-7xl to max-w-full to make it wider */}
      <section className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{t('home.yourProjects', 'Your Projects')}</h2>
            <p className="text-gray-500 mt-1">Manage your main workspaces and teams</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 px-5 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2">
              {t('home.createMainProject', 'New Project')}
            </button>
          </div>
        </div>

        {isLoading && <Spinner />}
        {error && <div className="text-center text-red-600 bg-red-50 p-4 rounded-lg border border-red-100">{error}</div>}
        
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {parentTeams.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <FolderIcon className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-lg font-medium">{t('home.noTeams', "You haven't joined any projects yet.")}</p>
                <button onClick={() => setIsCreateModalOpen(true)} className="mt-4 text-blue-600 font-medium hover:underline">
                    Create your first team &rarr;
                </button>
              </div>
            ) : (
              parentTeams.map((parent) => (
                    <TeamCard 
                        key={parent.id} 
                        team={parent} 
                        currentUser={user} 
                        userRole={userRole} 
                        onDeleteTeam={handleOpenDeleteParentModal}
                        onEditTeam={handleOpenEditModal}
                    />
                ))
            )}
          </div>
        )}
      </section>

      <CreateTeamModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onTeamCreated={handleRefresh} />
      <EditProjectModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} project={projectToEdit} onSave={handleUpdateProject} />
      <NotificationsModal isOpen={isNotificationsModalOpen} onClose={() => setIsNotificationsModalOpen(false)} />
      <ConfirmationModal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleConfirmDelete} title={t('common.confirmDeleteTeam', 'Delete this team?')} message={`${t('home.deleteSubConfirmPre', 'Delete')} "${parentTeamToDelete?.teamName}"?`} isDeleting={true} />
    </>
  );
};

export default HomePage;