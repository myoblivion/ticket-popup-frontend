// src/components/TeamView.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, collection, query, getDocs, deleteDoc, updateDoc,
  orderBy, onSnapshot, limit
} from "firebase/firestore";
import { db, auth } from '../firebaseConfig';
import { onAuthStateChanged } from "firebase/auth";
import InviteMemberModal from './InviteMemberModal';
import AnnounceModal from './AnnounceModal';
import ScheduleMeetingModal from './ScheduleMeetingModal';
import EditUpdateModal from './EditUpdateModal';
import HandoversSection from './EndorsementModal';
import FAQSection from './FAQSection'; 
import { LanguageContext } from '../contexts/LanguageContext.jsx';

// --- Icons ---
const HandoverIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>;
const QuestionMarkCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const XIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const MegaphoneIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>;
const UserGroupIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const ClockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

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

const formatTime12 = (timestamp) => {
    if (!timestamp) return '...';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- NEW HELPER: Calculate Duration ---
const getDurationString = (start, end) => {
    if (!start) return '';
    const startTime = start.toDate ? start.toDate() : new Date(start);
    const endTime = end ? (end.toDate ? end.toDate() : new Date(end)) : new Date();
    
    const diffMs = endTime - startTime;
    if (diffMs < 0) return '0s';

    const seconds = Math.floor((diffMs / 1000) % 60);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
    const hours = Math.floor((diffMs / (1000 * 60 * 60)));

    let str = '';
    if (hours > 0) str += `${hours}h `;
    if (minutes > 0) str += `${minutes}m `;
    if (hours === 0 && minutes === 0) str += `${seconds}s`;
    
    return str.trim();
};

const linkify = (text) => {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => part.match(urlRegex) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{part}</a> : part);
};

// --- AnnouncementsSection ---
const AnnouncementsSection = ({ teamId, refreshTrigger, isAdmin, onEdit }) => {
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center">
         <MegaphoneIcon />
         <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{t('admin.tabUpdates')}</h3>
      </div>
      
      {updates.length === 0 ? (
        <div className="p-6 text-center">
            <p className="text-sm text-gray-400 italic">{t('admin.noUpdates')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 overflow-y-auto max-h-[400px] custom-scrollbar">
          {updates.map(update => (
            <li key={update.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className={`text-xs font-bold uppercase mb-1 ${update.type === 'meeting' ? 'text-purple-600' : 'text-green-600'}`}>
                {update.type === 'meeting' ? t('admin.meeting') : t('admin.announcement')}
              </div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap mb-2">{linkify(update.text || update.title)}</div>
              <div className="flex justify-between items-end">
                  <p className="text-[10px] text-gray-400">
                      {update.creatorDisplayName} • {formatDate(update.createdAt)}
                  </p>
                  {isAdmin && <button onClick={() => onEdit(update)} className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded">Edit</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// --- MembersSection ---
const MembersSection = ({ membersDetails, teamData, canManageMembers, onInviteClick, onChangeRole }) => {
  const { t } = useContext(LanguageContext);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <div className="flex items-center text-gray-700">
            <UserGroupIcon />
            <h3 className="text-sm font-bold uppercase tracking-wide">{t('admin.tabMembers')}</h3>
        </div>
        {canManageMembers && (
            <button onClick={onInviteClick} className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-3 rounded-full transition-colors">
                + {t('admin.invite')}
            </button>
        )}
      </div>
      <ul className="divide-y divide-gray-50 overflow-y-auto max-h-[300px] custom-scrollbar">
        {membersDetails.map((member) => {
            const uid = member.uid;
            const isCreator = teamData?.createdBy === uid;
            const roleRaw = teamData?.roles?.[uid] || 'member';
            return (
              <li key={uid} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                      {(member.displayName || member.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate">{member.displayName || member.email}</span>
                      <span className="text-[10px] text-gray-500">{isCreator ? 'Owner' : roleRaw}</span>
                  </div>
                </div>
                {canManageMembers && !isCreator && (
                    <select value={roleRaw} onChange={(e) => onChangeRole(uid, e.target.value)} className="text-xs border-gray-200 border rounded px-1 py-1 bg-white focus:ring-blue-500 focus:border-blue-500">
                       <option value="admin">Admin</option>
                       <option value="member">Member</option>
                    </select>
                )}
              </li>
            );
        })}
      </ul>
    </div>
  );
};

// --- TeamWorkHistorySection ---
const TeamWorkHistorySection = ({ teamId }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 60000); 
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'teams', teamId, 'workLogs'), orderBy('createdAt', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snapshot) => {
            const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistory(logs);
            setLoading(false);
        });
        return () => unsub();
    }, [teamId]);

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center">
          <ClockIcon />
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Work History Log</h2>
        </div>
        <div className="p-6 flex-1 overflow-auto bg-white custom-scrollbar">
            {loading ? <Spinner /> : (
                <div className="space-y-6 relative ml-2">
                    {/* Timeline Line */}
                    <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200 z-0"></div>
                    
                    {history.length === 0 && <p className="text-center text-gray-400 z-10 relative">No activity recorded yet.</p>}
                    
                    {history.map(log => {
                        const isCompleted = log.status === 'completed';
                        const isActive = log.status === 'active';
                        const duration = getDurationString(log.startTime, isCompleted ? log.endTime : null);
                        
                        return (
                            <div key={log.id} className="relative z-10 flex gap-4 group">
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full border-4 border-white shadow-sm flex items-center justify-center 
                                    ${isActive ? 'bg-green-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div className="flex-1 pb-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{log.action || log.taskTitle}</p>
                                            <p className="text-xs text-gray-500">by <span className="text-gray-700 font-medium">{log.userName}</span></p>
                                        </div>
                                        {isActive && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Active</span>}
                                    </div>
                                    
                                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                         <span className="font-mono">{formatTime12(log.startTime)}</span>
                                         <span className="text-gray-300">→</span>
                                         <span className="font-mono">{isCompleted ? formatTime12(log.endTime) : 'Now'}</span>
                                         <div className="h-3 w-px bg-gray-300 mx-1"></div>
                                         <span className={`font-bold ${isActive ? 'text-green-600' : 'text-gray-600'}`}>
                                            {duration}
                                         </span>
                                    </div>
                                    <p className="text-[10px] text-gray-300 mt-1 text-right">{formatDate(log.createdAt)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      </div>
    );
};

// --- TeamView Component ---
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

  // Modals
  const [isFAQModalOpen, setIsFAQModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isAnnounceModalOpen, setIsAnnounceModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [isParentAdmin, setIsParentAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user && teamId) navigate('/login', { replace: true });
    });
    return unsub;
  }, [navigate, teamId]);

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

      const uids = [...new Set(members.map(m => typeof m === 'object' ? m.uid : m))];
      if (uids.length > 0) {
        const snaps = await Promise.all(uids.map(uid => getDoc(doc(db, "users", uid))));
        setMembersDetails(snaps.map((s, i) => s.exists() ? { uid: uids[i], ...s.data() } : { uid: uids[i], email: 'Unknown' }));
      }
    } catch (e) { setError("Failed to load"); } finally { setIsLoading(false); }
  }, [teamId, currentUser]);

  useEffect(() => { fetchTeamAndMembers(); }, [fetchTeamAndMembers, announcementRefreshKey]);

  const changeRole = async (memberUid, newRole) => {
      const isTeamCreator = teamData?.createdBy === currentUser?.uid;
      const isWorkAdmin = isTeamCreator || isMasterAdmin;
      if (!teamData || !currentUser || !isWorkAdmin || teamData.createdBy === memberUid) return;
      
      const targetUser = membersDetails.find(m => m.uid === memberUid);
      if (targetUser && targetUser.role === 'Master Admin') { alert(t('admin.cannotChangeMasterAdmin')); return; }

      const teamDocRef = doc(db, "teams", teamId);
      const rolesUpdate = { ...teamData.roles, [memberUid]: newRole };
      try {
          await updateDoc(teamDocRef, { roles: rolesUpdate });
          setTeamData(prev => ({ ...prev, roles: rolesUpdate }));
      } catch (err) {
          console.error("Error updating role:", err);
          setError(t('admin.changeRoleError'));
      }
  };

  const toggleModal = (type, isOpen, data) => {
      if(type === 'edit') { setEditTarget(data); setIsEditModalOpen(isOpen); }
  };

  const isTeamCreator = teamData?.createdBy === currentUser?.uid;
  const isWorkAdmin = isTeamCreator || isMasterAdmin;

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-12 font-sans w-full">
        {/* Top Navbar Style Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 mb-8 sticky top-0 z-30 shadow-sm">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <Link to="/home" className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </Link>
                    <div>
                         {isLoading ? <div className="h-6 w-32 bg-gray-200 animate-pulse rounded"></div> : (
                             <h1 className="text-2xl font-bold text-gray-900 leading-none">{teamData?.teamName}</h1>
                         )}
                         <p className="text-xs text-gray-500 mt-1">Workforce Management Dashboard</p>
                    </div>
                </div>
                {/* Global Actions on Header */}
                <div className="flex gap-3">
                     {/* Mobile Only Actions could go here, but kept simple for now */}
                </div>
            </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading && <Spinner large />}
          {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200 text-center">{error}</div>}

          {!isLoading && !error && teamData && isAuthorized && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* --- MAIN COLUMN (Left - 8 Cols) --- */}
              <div className="col-span-1 lg:col-span-8 space-y-8">
                
                {/* 1. Projects & Tasks (The Core Work) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                   <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                            <HandoverIcon />
                         </div>
                         <div>
                            <h2 className="text-lg font-bold text-gray-900">Projects & Tasks</h2>
                            <p className="text-xs text-gray-500">Manage deliverables and track active work</p>
                         </div>
                      </div>
                   </div>
                   <div className="p-0">
                       <HandoversSection 
                         teamId={teamId} 
                         membersDetails={membersDetails}
                         isTeamCreator={isTeamCreator}
                         currentUserUid={currentUser?.uid}
                       />
                   </div>
                </div>

                {/* 2. Work History (Audit Trail) */}
                <div style={{ height: '500px' }}>
                    <TeamWorkHistorySection teamId={teamId} />
                </div>
              </div>

              {/* --- SIDEBAR COLUMN (Right - 4 Cols) --- */}
              <div className="col-span-1 lg:col-span-4 space-y-6">
                
                {/* 1. Quick Actions Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h3>
                     <div className="grid grid-cols-2 gap-3">
                         <button onClick={() => setIsFAQModalOpen(true)} className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-100 hover:bg-blue-50 hover:border-blue-100 transition-all group">
                             <QuestionMarkCircleIcon />
                             <span className="text-sm font-medium text-gray-600 group-hover:text-blue-600 mt-1">FAQ</span>
                         </button>
                         {isWorkAdmin && (
                            <button onClick={() => setIsAnnounceModalOpen(true)} className="flex flex-col items-center justify-center p-3 rounded-lg border border-green-100 bg-green-50/50 hover:bg-green-100 transition-all group">
                                <MegaphoneIcon />
                                <span className="text-sm font-medium text-green-700 mt-1">Update</span>
                            </button>
                         )}
                     </div>
                </div>

                {/* 2. Announcements */}
                <div className="h-[400px]">
                    <AnnouncementsSection teamId={teamId} refreshTrigger={announcementRefreshKey} isAdmin={isWorkAdmin} onEdit={(u) => toggleModal('edit', true, u)} />
                </div>

                {/* 3. Members */}
                <div className="h-[400px]">
                    <MembersSection membersDetails={membersDetails} teamData={teamData} canManageMembers={isWorkAdmin} onChangeRole={changeRole} onInviteClick={() => setIsInviteModalOpen(true)} />
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {isFAQModalOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"><div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[85vh] relative"><button onClick={() => setIsFAQModalOpen(false)} className="absolute top-4 right-4"><XIcon /></button><div className="flex-1 overflow-hidden"><FAQSection teamId={teamId} isAdmin={isWorkAdmin} /></div></div></div>)}
      <InviteMemberModal t={t} isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} teamId={teamId} />
      <AnnounceModal t={t} isOpen={isAnnounceModalOpen} onClose={() => setIsAnnounceModalOpen(false)} teamId={teamId} onAnnouncementPosted={() => setAnnouncementRefreshKey(k=>k+1)} />
      {isEditModalOpen && <EditUpdateModal t={t} isOpen={isEditModalOpen} onClose={() => toggleModal('edit', false)} teamId={teamId} updateId={editTarget?.id} updateType={editTarget?.type} initialData={editTarget} onSaved={() => setAnnouncementRefreshKey(k=>k+1)} />}
    </>
  );
};

export default TeamView;