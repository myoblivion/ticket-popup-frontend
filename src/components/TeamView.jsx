// src/components/TeamView.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, collection, query, orderBy, onSnapshot, deleteDoc
} from "firebase/firestore";
import { db, auth } from '../firebaseConfig';
import { onAuthStateChanged } from "firebase/auth";
import InviteMemberModal from './InviteMemberModal';
import AnnounceModal from './AnnounceModal';
import EditUpdateModal from './EditUpdateModal';
import HandoversSection from './EndorsementModal'; 
import AddEndorsementModal from './AddEndorsementModal'; 
import FAQSection from './FAQSection'; 
import { LanguageContext } from '../contexts/LanguageContext.jsx';

// --- Icons ---
const ChevronDownIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
const ChevronRightIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;
const PlusIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const TrashIcon = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const FolderIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
const AlertIcon = () => <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
const UserGroupIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const MegaphoneIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>;
const ClipboardIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
const QuestionMarkCircleIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const XIcon = () => <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const BellIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
const BriefcaseIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;

// --- Helper Components ---
const Spinner = ({ large = false }) => (
  <div className="flex justify-center items-center py-10">
    <div className={`border-4 border-blue-500 border-t-transparent rounded-full animate-spin ${large ? 'w-8 h-8' : 'w-6 h-6'}`}></div>
  </div>
);

const formatDate = (value) => {
  if (!value) return '';
  const d = value?.toDate ? value.toDate() : new Date(value);
  return isNaN(d) ? '' : d.toLocaleString();
};

const linkify = (text) => {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => part.match(urlRegex) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{part}</a> : part);
};

// --- Members List Modal ---
const MembersListModal = ({ isOpen, onClose, members, onInvite }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">Team Members ({members.length})</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1 bg-white rounded-full hover:bg-gray-100 transition"><XIcon /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {members.length === 0 ? (
              <p className="text-center text-gray-400 py-4 text-sm">No members yet.</p>
          ) : (
              <div className="space-y-1">
                  {members.map(m => (
                    <div key={m.uid} className="flex items-center gap-3 p-2 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {(m.displayName || m.email || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold text-gray-800 truncate">{m.displayName || 'Unnamed User'}</p>
                        <p className="text-xs text-gray-500 truncate">{m.email}</p>
                      </div>
                    </div>
                  ))}
              </div>
          )}
        </div>
        <div className="p-4 border-t bg-gray-50">
          <button onClick={() => { onClose(); onInvite(); }} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition-all flex items-center justify-center gap-2">
            <PlusIcon /> Invite New Member
          </button>
        </div>
      </div>
    </div>
  );
};

// --- AnnouncementsSection ---
const AnnouncementsSection = ({ teamId, isAdmin, onEdit }) => {
  const { t } = useContext(LanguageContext);
  const [updates, setUpdates] = useState([]);
  
  useEffect(() => {
    const q = query(collection(db, `teams/${teamId}/announcements`), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
       setUpdates(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [teamId]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <BellIcon />
            <h3 className="text-lg font-bold text-gray-800">Announcements</h3>
         </div>
      </div>
      
      {updates.length === 0 ? (
        <div className="p-12 text-center flex-1 flex items-center justify-center">
            <p className="text-gray-400 italic">{t('admin.noUpdates')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-y-auto flex-1 p-4 custom-scrollbar">
          {updates.map(update => (
            <li key={update.id} className="p-4 mb-4 bg-gray-50 rounded-lg border border-gray-100 hover:shadow-sm transition-shadow">
              <div className={`text-xs font-bold uppercase mb-2 ${update.type === 'meeting' ? 'text-purple-600' : 'text-blue-600'}`}>
                {update.type === 'meeting' ? t('admin.meeting') : t('admin.announcement')}
              </div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap mb-3 leading-relaxed">{linkify(update.text || update.title)}</div>
              <div className="flex justify-between items-end border-t border-gray-200 pt-2 mt-2">
                  <p className="text-[10px] text-gray-400 font-medium">
                      {update.creatorDisplayName} • {formatDate(update.createdAt)}
                  </p>
                  {isAdmin && <button onClick={() => onEdit(update)} className="text-[10px] bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-1 rounded font-medium shadow-sm">Edit</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// --- Sidebar Item Helper ---
const SidebarItem = ({ icon, label, active, onClick, hasSubmenu, expanded }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
    >
        <div className="flex items-center gap-3">
            {icon}
            <span>{label}</span>
        </div>
        {hasSubmenu && (expanded ? <ChevronDownIcon /> : <ChevronRightIcon />)}
    </button>
);

const TeamView = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { t } = useContext(LanguageContext);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [teamData, setTeamData] = useState(null);
  const [membersDetails, setMembersDetails] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [announcementRefreshKey, setAnnouncementRefreshKey] = useState(0);

  // --- Project State ---
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null); // 'all' or specific ID
  const [categoriesList, setCategoriesList] = useState([]);

  // --- Sidebar State ---
  const [sidebarState, setSidebarState] = useState({
      projects: true,
      myTasks: true,
  });

  // Modals
  const [isFAQModalOpen, setIsFAQModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isMembersListOpen, setIsMembersListOpen] = useState(false); // New state for list modal
  const [isAnnounceModalOpen, setIsAnnounceModalOpen] = useState(false);
  const [isViewAnnounceModalOpen, setIsViewAnnounceModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const [isMasterAdmin, setIsMasterAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user && teamId) navigate('/login', { replace: true });
    });
    return unsub;
  }, [navigate, teamId]);

  // Fetch Team & Members
  const fetchTeamAndMembers = useCallback(async () => {
    if (!teamId || !currentUser) return;
    setIsLoading(true); setError(null);
    try {
      const teamDocRef = doc(db, "teams", teamId);
      const userDocRef = doc(db, "users", currentUser.uid);
      const [teamDocSnap, userDocSnap] = await Promise.all([ getDoc(teamDocRef), getDoc(userDocRef) ]);

      if (!teamDocSnap.exists()) { setError("Team not found"); setIsLoading(false); return; }
      
      const teamD = teamDocSnap.data();
      const members = teamD.members || [];
      const isMem = members.some(m => (typeof m === 'object' ? m.uid : m) === currentUser.uid);
      
      if (!isMem && userDocSnap.data()?.role !== 'Master Admin') {
          setError("Access Denied"); setIsLoading(false); return;
      }

      setIsAuthorized(true);
      setTeamData({ id: teamDocSnap.id, ...teamD });
      if(teamD.endorsementCategories) setCategoriesList(teamD.endorsementCategories);

      const uids = [...new Set(members.map(m => typeof m === 'object' ? m.uid : m))];
      if (uids.length > 0) {
        const snaps = await Promise.all(uids.map(uid => getDoc(doc(db, "users", uid))));
        setMembersDetails(snaps.map((s, i) => s.exists() ? { uid: uids[i], ...s.data() } : { uid: uids[i], email: 'Unknown' }));
      }
    } catch (e) { setError("Failed to load"); } finally { setIsLoading(false); }
  }, [teamId, currentUser]);

  useEffect(() => { fetchTeamAndMembers(); }, [fetchTeamAndMembers, announcementRefreshKey]);

  // Fetch Projects for Sidebar
  useEffect(() => {
      if (!teamId || !isAuthorized) return;
      const q = query(collection(db, `teams/${teamId}/handovers`), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
         setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsub();
  }, [teamId, isAuthorized]);

  const toggleSidebar = (section) => {
      setSidebarState(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleModal = (type, isOpen, data) => {
      if(type === 'edit') { setEditTarget(data); setIsEditModalOpen(isOpen); }
  };

  const deleteProject = async (e, projectId, projectTitle) => {
      e.stopPropagation();
      if (!window.confirm(`Are you sure you want to delete project: "${projectTitle}"?\nThis cannot be undone.`)) return;
      try {
          await deleteDoc(doc(db, `teams/${teamId}/handovers`, projectId));
          if (selectedProjectId === projectId) setSelectedProjectId(null); // Reset selection
      } catch (err) {
          alert("Error deleting project");
          console.error(err);
      }
  };

  const isTeamCreator = teamData?.createdBy === currentUser?.uid;
  const isWorkAdmin = isTeamCreator || isMasterAdmin;

  return (
    <>
      <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
        
        {/* --- LEFT SIDEBAR (Projects & Utilities) --- */}
        {!isLoading && isAuthorized && (
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-20">
                {/* 1. Header/Logo Area */}
                <div className="h-16 flex items-center px-6 border-b border-gray-100">
                    <h1 className="text-lg font-bold text-gray-800 truncate">{teamData?.teamName || 'TeamFlow'}</h1>
                </div>

                {/* 2. Scrollable Menu Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-1">
                    
                    {/* UTILITIES */}
                    <div className="px-4 mb-4">
                         <div className="flex items-center gap-2 mb-2 px-2">
                             <AlertIcon />
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Workspace</p>
                         </div>
                        <button onClick={() => setIsFAQModalOpen(true)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">
                            <QuestionMarkCircleIcon />
                            <span>Info Board</span>
                        </button>
                        
                        <button onClick={() => setIsViewAnnounceModalOpen(true)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">
                            <BellIcon />
                            <span>View Announcements</span>
                        </button>

                        <button onClick={() => setIsMembersListOpen(true)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">
                            <UserGroupIcon />
                            <span>Members ({membersDetails.length})</span>
                        </button>
                    </div>

                    <div className="my-2 border-t border-gray-100 mx-4"></div>

                    {/* PROJECT LIST */}
                    <div className="px-4 mb-1 flex items-center justify-between group">
                        <button 
                             onClick={() => toggleSidebar('projects')}
                             className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600"
                        >
                             <BriefcaseIcon />
                             Projects
                        </button>
                        {isWorkAdmin && (
                            <button 
                                onClick={() => setIsAddProjectModalOpen(true)}
                                className="text-gray-400 hover:text-blue-600 p-1 rounded"
                                title="Create New Project"
                            >
                                <PlusIcon />
                            </button>
                        )}
                    </div>
                    
                    {sidebarState.projects && (
                        <div className="space-y-0.5 px-2">
                            {/* All Projects / All Tasks View */}
                            <button 
                                onClick={() => setSelectedProjectId(null)}
                                className={`w-full text-left flex items-center px-3 py-2 text-sm rounded-md transition-colors ${selectedProjectId === null ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <div className="flex-1 truncate">All Tasks</div>
                            </button>

                            {/* Individual Projects */}
                            {projects.map(proj => (
                                <div key={proj.id} className="relative group">
                                    <button 
                                        onClick={() => setSelectedProjectId(proj.id)}
                                        className={`w-full text-left flex items-center px-3 py-2 text-sm rounded-md transition-colors pr-8 ${selectedProjectId === proj.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <FolderIcon />
                                            <span className="truncate">{proj.title}</span>
                                        </div>
                                    </button>
                                    {isWorkAdmin && (
                                        <button 
                                            onClick={(e) => deleteProject(e, proj.id, proj.title)}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                            title="Delete Project"
                                        >
                                            <TrashIcon />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {projects.length === 0 && (
                                <div className="px-4 py-2 text-xs text-gray-400 italic">No projects yet.</div>
                            )}
                        </div>
                    )}

                    <div className="my-2 border-t border-gray-100 mx-4"></div>
                    
                    {/* MY TASKS SHORTCUT */}
                    <div className="px-4">
                        <button 
                            onClick={() => setSelectedProjectId('my_tasks')} // Special ID for filtering my tasks across all projects
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${selectedProjectId === 'my_tasks' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <ClipboardIcon />
                            <span>My Assigned Tasks</span>
                        </button>
                    </div>

                </div>

                {/* 3. Footer / User Info */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                            {currentUser?.email?.[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-xs font-bold text-gray-700 truncate">{currentUser?.email}</span>
                            <Link to="/home" className="text-[10px] text-blue-500 hover:underline">Switch Team</Link>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- MAIN CONTENT AREA (Tasks List) --- */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50">
            {isLoading ? <Spinner large /> : (
                <>
                    {/* Dynamic Header */}
                    <div className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shadow-sm z-10">
                        <div>
                             <h2 className="text-xl font-bold text-gray-800">
                                 {selectedProjectId === null ? 'All Tasks Overview' : 
                                  selectedProjectId === 'my_tasks' ? 'My Assigned Tasks' :
                                  projects.find(p => p.id === selectedProjectId)?.title || 'Project Tasks'}
                             </h2>
                             <p className="text-xs text-gray-500">
                                 {selectedProjectId === null ? `Viewing tasks from all ${projects.length} projects` : 
                                  selectedProjectId === 'my_tasks' ? 'Tasks assigned specifically to you' :
                                  'Viewing project specific tasks'}
                             </p>
                        </div>
                        
                        {/* Quick Action: New Announcement */}
                        {isWorkAdmin && (
                            <button onClick={() => setIsAnnounceModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-full border border-green-200 hover:bg-green-100">
                                <MegaphoneIcon />
                                <span>Announce</span>
                            </button>
                        )}
                    </div>

                    {/* Main Workspace: HandoversSection now acts as Task Board */}
                    <div className="flex-1 overflow-hidden p-6">
                        {error && <div className="p-4 bg-red-50 text-red-600 rounded mb-4">{error}</div>}
                        
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
                             <HandoversSection 
                                teamId={teamId} 
                                membersDetails={membersDetails}
                                isTeamCreator={isTeamCreator}
                                currentUserUid={currentUser?.uid}
                                selectedProjectId={selectedProjectId} // Passing the selection down
                             />
                        </div>
                    </div>
                </>
            )}
        </div>

      </div>

      {/* --- MODALS --- */}
      {isFAQModalOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"><div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[85vh] relative"><button onClick={() => setIsFAQModalOpen(false)} className="absolute top-4 right-4"><XIcon /></button><div className="flex-1 overflow-hidden"><FAQSection teamId={teamId} isAdmin={isWorkAdmin} /></div></div></div>)}
      
      {/* View Announcements Modal */}
      {isViewAnnounceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl h-[70vh] relative flex flex-col overflow-hidden">
                  <button onClick={() => setIsViewAnnounceModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 z-10"><XIcon /></button>
                  <div className="flex-1 overflow-hidden">
                      <AnnouncementsSection teamId={teamId} isAdmin={isWorkAdmin} onEdit={(u) => toggleModal('edit', true, u)} />
                  </div>
              </div>
          </div>
      )}

      {/* MEMBERS LIST MODAL */}
      <MembersListModal 
          isOpen={isMembersListOpen}
          onClose={() => setIsMembersListOpen(false)}
          members={membersDetails}
          onInvite={() => setIsInviteModalOpen(true)}
      />

      {/* ADD PROJECT MODAL (Now triggered from Sidebar) */}
      <AddEndorsementModal
        isOpen={isAddProjectModalOpen}
        onClose={() => setIsAddProjectModalOpen(false)}
        teamId={teamId}
        t={t}
        categoriesList={categoriesList || ['General']}
        membersList={membersDetails.map(m => ({ uid: m.uid, label: m.displayName || m.email }))}
        onEndorsementAdded={() => setIsAddProjectModalOpen(false)}
      />

      <InviteMemberModal t={t} isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} teamId={teamId} />
      <AnnounceModal t={t} isOpen={isAnnounceModalOpen} onClose={() => setIsAnnounceModalOpen(false)} teamId={teamId} onAnnouncementPosted={() => setAnnouncementRefreshKey(k=>k+1)} />
      {isEditModalOpen && <EditUpdateModal t={t} isOpen={isEditModalOpen} onClose={() => toggleModal('edit', false)} teamId={teamId} updateId={editTarget?.id} updateType={editTarget?.type} initialData={editTarget} onSaved={() => setAnnouncementRefreshKey(k=>k+1)} />}
    </>
  );
};

export default TeamView;