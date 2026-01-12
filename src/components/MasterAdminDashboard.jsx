// src/components/MasterAdminDashboard.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; 
import {
  collection, query, orderBy, getDocs, deleteDoc, doc, where, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { signOut } from "firebase/auth";
import { db, auth } from '../firebaseConfig';

// --- ICONS ---
const ShieldCheckIcon = () => <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const LogoutIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const UserIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;

const MasterAdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('teams'); // 'teams', 'users'
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- FETCH DATA ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch ALL Teams (No 'where' clause limits)
      const teamsQ = query(collection(db, "teams"), orderBy("createdAt", "desc"));
      const teamsSnap = await getDocs(teamsQ);
      const teamsData = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTeams(teamsData);

      // 2. Fetch ALL Users
      const usersQ = query(collection(db, "users")); // Assuming you have a 'users' collection
      const usersSnap = await getDocs(usersQ);
      // Fallback if you don't store users in a collection yet, this part might be empty
      const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(usersData);

    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- ACTIONS ---
  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    if(!window.confirm(`MASTER ADMIN: Are you sure you want to PERMANENTLY delete the team "${teamName}"? This cannot be undone.`)) return;
    
    try {
      await deleteDoc(doc(db, "teams", teamId));
      setTeams(prev => prev.filter(t => t.id !== teamId));
      alert("Team deleted by Master Admin.");
    } catch (err) {
      console.error(err);
      alert("Error deleting team.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {/* --- HEADER --- */}
      <header className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon />
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">MASTER ADMIN CONSOLE</h1>
              <p className="text-xs text-yellow-400 font-mono">FULL ACCESS GRANTED</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <span className="text-sm text-gray-400 hidden md:block">
                {auth.currentUser?.email}
             </span>
             <button 
               onClick={handleLogout}
               className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-bold transition-colors"
             >
               <LogoutIcon /> Logout
             </button>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-sm">
                <h3 className="text-gray-400 text-sm font-semibold uppercase">Total Teams</h3>
                <p className="text-3xl font-bold text-white mt-2">{teams.length}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-sm">
                <h3 className="text-gray-400 text-sm font-semibold uppercase">Total Users</h3>
                <p className="text-3xl font-bold text-white mt-2">{users.length}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-sm">
                <h3 className="text-gray-400 text-sm font-semibold uppercase">System Status</h3>
                <p className="text-3xl font-bold text-green-400 mt-2">Active</p>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-700 pb-1">
            <button 
                onClick={() => setActiveTab('teams')}
                className={`pb-3 px-2 text-sm font-bold transition-colors ${activeTab === 'teams' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}`}
            >
                ALL TEAMS
            </button>
            <button 
                onClick={() => setActiveTab('users')}
                className={`pb-3 px-2 text-sm font-bold transition-colors ${activeTab === 'users' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}`}
            >
                ALL USERS
            </button>
        </div>

        {loading ? (
            <div className="text-center py-20 text-gray-500">Loading Master Data...</div>
        ) : (
            <>
                {/* --- TEAMS VIEW --- */}
                {activeTab === 'teams' && (
                    <div className="bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-700">
                        <table className="w-full text-left">
                            <thead className="bg-gray-900 text-gray-400 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4">Team Name</th>
                                    <th className="px-6 py-4">Created By</th>
                                    <th className="px-6 py-4">Members</th>
                                    <th className="px-6 py-4">Created At</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {teams.map((team) => (
                                    <tr key={team.id} className="hover:bg-gray-750 transition-colors">
                                        <td className="px-6 py-4 font-medium text-white">
                                            <div className="flex items-center gap-2">
                                                {/* Clicking this takes Admin to the actual Team View in "God Mode" */}
                                                <Link to={`/team/${team.id}`} className="text-blue-400 hover:underline hover:text-blue-300">
                                                    {team.teamName}
                                                </Link>
                                                {team.parentTeamId && <span className="text-[10px] bg-gray-600 px-1 rounded text-white">SUB</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300 text-sm">{team.createdByEmail || team.createdBy || 'Unknown'}</td>
                                        <td className="px-6 py-4 text-gray-300 text-sm">{team.assignees ? team.assignees.length : 0} members</td>
                                        <td className="px-6 py-4 text-gray-400 text-xs">
                                            {team.createdAt?.seconds ? new Date(team.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleDeleteTeam(team.id, team.teamName)}
                                                className="text-red-400 hover:text-red-300 hover:bg-gray-700 p-2 rounded"
                                                title="Force Delete"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {teams.length === 0 && (
                                    <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No teams found in database.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* --- USERS VIEW --- */}
                {activeTab === 'users' && (
                    <div className="bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-700">
                        <table className="w-full text-left">
                            <thead className="bg-gray-900 text-gray-400 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4">UID</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-gray-750">
                                        <td className="px-6 py-4 text-white font-medium flex items-center gap-3">
                                            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-xs">
                                                {u.photoURL ? <img src={u.photoURL} className="w-8 h-8 rounded-full"/> : <UserIcon />}
                                            </div>
                                            {u.displayName || 'No Name'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">{u.email}</td>
                                        <td className="px-6 py-4 text-gray-500 text-xs font-mono">{u.uid || u.id}</td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr><td colSpan="3" className="px-6 py-8 text-center text-gray-500">No users found (ensure you are saving users to a 'users' collection on register).</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </>
        )}
      </main>
    </div>
  );
};

export default MasterAdminDashboard;