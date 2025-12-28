import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp,
  doc, // Import doc
  getDoc // Import getDoc
} from 'firebase/firestore';
import Spinner from './Spinner';

// Utility: formatChatTimestamp (remains the same)
const formatChatTimestamp = (value) => {
    if (!value) return '';
  try {
    const d = (value instanceof Timestamp) ? value.toDate() : new Date(value);
    if (isNaN(d)) return String(value);

    const now = new Date();
    const yesterdayCheckDate = new Date();
    yesterdayCheckDate.setDate(yesterdayCheckDate.getDate() - 1);

    const isToday = d.toDateString() === now.toDateString();
    const isYesterday = d.toDateString() === yesterdayCheckDate.toDateString();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else if (isYesterday) {
      return `Yesterday ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
  } catch (err) {
    console.error('formatChatTimestamp error', err, value);
    return String(value);
  }
};

// Back Arrow Icon
const BackArrowIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);


const TeamChatModal = ({ isOpen, onClose }) => {
  const [currentView, setCurrentView] = useState('teamList'); // 'teamList' or 'chatView'
  const [userTeams, setUserTeams] = useState([]); // Now stores { id, teamName, unreadCount }
  const [selectedTeam, setSelectedTeam] = useState(null); // { id, teamName, unreadCount }
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // --- NEW: State to hold user role ---
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);

  const messagesEndRef = useRef(null);

  // 1. Fetch user's teams AND unread counts
  useEffect(() => {
    if (!isOpen) {
      // Fully reset when modal closes
      setCurrentView('teamList');
      setSelectedTeam(null);
      setMessages([]);
      setUserTeams([]);
      setError('');
      setIsMasterAdmin(false); // Reset admin state
      return;
    }

    if (currentView === 'teamList') {
      const fetchUserTeams = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        setLoadingTeams(true);
        setError('');
        
        let role = 'Member';
        try {
          // --- NEW: Check user's role first ---
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists() && userDocSnap.data().role === 'Master Admin') {
            role = 'Master Admin';
            setIsMasterAdmin(true);
          } else {
            setIsMasterAdmin(false);
          }

          // --- Get Teams based on role ---
          const teamsRef = collection(db, 'teams');
          let teamsQuery;

          if (role === 'Master Admin') {
            // Master Admin sees ALL teams
            teamsQuery = query(teamsRef, orderBy('teamName', 'asc'));
          } else {
            // Normal user sees only their teams
            teamsQuery = query(teamsRef, where('members', 'array-contains', currentUser.uid), orderBy('teamName', 'asc'));
          }
          
          const querySnapshot = await getDocs(teamsQuery);
          
          if (querySnapshot.empty && role !== 'Master Admin') {
             setError("You are not a member of any teams.");
             setUserTeams([]);
             setLoadingTeams(false);
             return;
          }

          // --- Get unread counts (only for non-admins) ---
          const teamsWithCounts = await Promise.all(querySnapshot.docs.map(async (doc) => {
            const teamData = doc.data();
            const teamId = doc.id;
            const teamName = teamData.teamName || `Team ${teamId}`;
            let unreadCount = 0;

            // Only calculate unread for non-admins
            if (role !== 'Master Admin') {
              const lastReadString = localStorage.getItem(`lastRead_${teamId}`);
              const lastReadTimestamp = lastReadString ? new Date(lastReadString) : null;
              
              const messagesRef = collection(db, `teams/${teamId}/chatMessages`);
              let unreadQuery;

              if (lastReadTimestamp) {
                unreadQuery = query(
                  messagesRef, 
                  where('createdAt', '>', Timestamp.fromDate(lastReadTimestamp)),
                  where('senderId', '!=', currentUser.uid)
                );
              } else {
                unreadQuery = query(
                  messagesRef, 
                  where('senderId', '!=', currentUser.uid)
                );
              }
              const unreadSnapshot = await getDocs(unreadQuery);
              unreadCount = unreadSnapshot.size;
            }
            
            return { id: teamId, teamName, unreadCount };
          }));
          
          setUserTeams(teamsWithCounts); // Already sorted by query

        } catch (err) {
          console.error("Error fetching user's teams:", err);
          setError("Could not load your teams.");
        } finally {
          setLoadingTeams(false);
        }
      };
      fetchUserTeams();
    }
  }, [isOpen, currentView]); // Refetch teams when modal opens or view returns to list

  // 2. Set up message listener when a team is selected
  useEffect(() => {
    if (currentView !== 'chatView' || !selectedTeam?.id || !isOpen) {
      setMessages([]); 
      return;
    }

    setLoadingMessages(true);
    setError('');
    const messagesRef = collection(db, `teams/${selectedTeam.id}/chatMessages`);
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setLoadingMessages(false);
    }, (err) => {
      console.error(`Error listening to messages for team ${selectedTeam.id}:`, err);
      setError(`Could not load messages for ${selectedTeam.teamName}.`);
      setLoadingMessages(false);
    });

    return () => unsubscribe(); // Cleanup listener

  }, [currentView, selectedTeam?.id, isOpen]);

  // 3. Scroll to bottom
  useEffect(() => {
    if (currentView === 'chatView') {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, currentView]);

  // 4. Handle sending message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTeam?.id || isSending || currentView !== 'chatView') return;

    const currentUser = auth.currentUser;
    if (!currentUser) { setError("You must be logged in."); return; }

    setIsSending(true);
    setError('');
    try {
      const messagesRef = collection(db, `teams/${selectedTeam.id}/chatMessages`);
      await addDoc(messagesRef, {
        text: newMessage.trim(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email || 'User',
        createdAt: serverTimestamp()
      });
      setNewMessage('');
      
      // Also set *my* last read time, even as admin
      localStorage.setItem(`lastRead_${selectedTeam.id}`, new Date().toISOString());

    } catch (err) {
      console.error("Error sending message:", err);
      setError("Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  // 5. Handle selecting a team from the list
  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
    setCurrentView('chatView'); // Switch to chat view
    setError(''); // Clear any previous errors
    
    // --- MARK AS READ (for all users, including admin) ---
    localStorage.setItem(`lastRead_${team.id}`, new Date().toISOString());
    
    // Immediately clear the badge in the UI
    if (!isMasterAdmin) { // Only update local state if not admin (admin list doesn't show counts)
      setUserTeams(prevTeams => 
        prevTeams.map(t => 
          t.id === team.id ? { ...t, unreadCount: 0 } : t
        )
      );
    }
  };

  // 6. Handle going back to the team list
  const handleGoBack = () => {
    setSelectedTeam(null);
    setCurrentView('teamList'); // Switch back to team list view
    setMessages([]); // Clear messages
    setError('');
    // This will trigger the team list useEffect to refetch
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-end z-50 p-4 sm:p-6">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md h-[70vh] flex flex-col overflow-hidden">

        {/* Header - Content changes based on view */}
        <div className="flex justify-between items-center p-3 border-b bg-gray-50 flex-shrink-0">
          {currentView === 'chatView' && selectedTeam && (
            <button
              onClick={handleGoBack}
              className="p-1 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-200 mr-2"
              aria-label="Back to team list"
            >
              <BackArrowIcon />
            </button>
          )}
          <h3 className="text-sm font-semibold text-gray-800 truncate flex-grow">
            {currentView === 'teamList' 
              ? (isMasterAdmin ? 'All Team Chats' : 'Select Team Chat') 
              : (selectedTeam?.teamName || 'Chat')
            }
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-2">&times;</button>
        </div>

        {/* Body - Content changes based on view */}
        <div className="flex-grow overflow-y-auto bg-gray-100">
          {error && <p className="text-red-500 text-sm text-center p-4">{error}</p>}

          {/* Team List View */}
          {currentView === 'teamList' && (
            <div className="p-2 space-y-1">
              {loadingTeams && <div className="flex justify-center py-4"><Spinner /></div>}
              {!loadingTeams && userTeams.length === 0 && !error && (
                <p className="text-sm text-gray-500 text-center py-4">No teams found.</p>
              )}
              {!loadingTeams && userTeams.map(team => (
                <button
                  key={team.id}
                  onClick={() => handleTeamSelect(team)}
                  className="w-full text-left p-3 bg-white rounded-md shadow-sm border border-gray-200 hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{team.teamName}</span>
                    {/* Only show unread count if user is NOT admin */}
                    {!isMasterAdmin && team.unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                        {team.unreadCount > 9 ? '9+' : team.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Chat View */}
          {currentView === 'chatView' && (
            <div className="p-4 space-y-3">
              {loadingMessages && <div className="flex justify-center py-4"><Spinner /></div>}
              {!loadingMessages && messages.length === 0 && !error && (
                   <p className="text-sm text-gray-500 text-center py-4">No messages yet. Start the conversation!</p>
              )}
              {messages.map(msg => {
                const isCurrentUser = msg.senderId === auth.currentUser?.uid;
                // Check if sender is admin for special styling
                const senderIsAdmin = isMasterAdmin && isCurrentUser;
                return (
                  <div key={msg.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-lg shadow-sm ${
                      senderIsAdmin ? 'bg-indigo-600 text-white' : // Admin's own messages
                      isCurrentUser ? 'bg-blue-500 text-white' : // Normal user's own messages
                      'bg-white text-gray-800' // Other people's messages
                    }`}>
                      {!isCurrentUser && (
                        <p className="text-xs font-semibold text-gray-600 mb-0.5">{msg.senderName || 'User'}</p>
                      )}
                      <p className="text-sm break-words">{msg.text}</p>
                      <p className={`text-xs mt-1 text-right ${
                        senderIsAdmin ? 'text-indigo-100 opacity-80' : 
                        isCurrentUser ? 'text-blue-100 opacity-80' : 
                        'text-gray-400'
                      }`}>
                        {formatChatTimestamp(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} /> {/* Scroll target */}
            </div>
          )}
        </div>

        {/* Input Area - Only show in chatView */}
        {currentView === 'chatView' && (
          <form onSubmit={handleSendMessage} className="p-3 border-t bg-gray-50 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Message ${selectedTeam?.teamName || ''}...`}
                className="flex-grow p-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-200"
                disabled={!selectedTeam || isSending || loadingMessages || loadingTeams}
                autoFocus // Focus input when chat view loads
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || !selectedTeam || isSending || loadingMessages || loadingTeams}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? <Spinner /> : 'Send'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default TeamChatModal;