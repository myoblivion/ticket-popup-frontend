// src/components/HandoverPopup.jsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import { db, auth } from '../firebaseConfig';
import { 
  doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, 
  arrayUnion, arrayRemove, query, where, onSnapshot, orderBy 
} from 'firebase/firestore'; 
import { LanguageContext } from '../contexts/LanguageContext';

// --- CONFIGURATION ---
// ⚠️ SECURITY WARNING: Revoke this token in BotFather and move logic to Backend (Cloud Functions) for production.
const TELEGRAM_BOT_TOKEN = '8204073221:AAEuEMTZoeRAPBx0IjkSc-ZafHjiTMarb6g'; 

// --- TELEGRAM HELPER (Updated) ---
const sendTelegramNotification = async (chatId, type, details) => {
    if (!TELEGRAM_BOT_TOKEN || !chatId) return;

    const { userName, projectName, taskName, startTime, duration, priority, projectUrl } = details;
    const now = new Date().toLocaleString();
    const startStr = startTime ? new Date(startTime).toLocaleString() : now;

    let message = '';

    // --- FIX: Display raw URL so Telegram auto-links it (works better for localhost) ---
    const linkHtml = projectUrl ? `\n\n🔗 ${projectUrl}` : '';

    if (type === 'create_task') {
        message = `
<b>🆕 New Task Created</b>
👤 <b>User:</b> ${userName}
📂 <b>Project:</b> ${projectName}
📝 <b>Task:</b> ${taskName}
🔥 <b>Priority:</b> ${priority}${linkHtml}
        `;
    } else if (type === 'start' || type === 'resume') {
        const emoji = type === 'resume' ? '▶️' : '🚀';
        const action = type === 'resume' ? 'Resumed Task' : 'Started Task';
        
        message = `
<b>${emoji} User ${action}</b>
👤 <b>User:</b> ${userName}
📂 <b>Project:</b> ${projectName}
TB <b>Task:</b> ${taskName}
⏰ <b>Start Time:</b> ${startStr}${linkHtml}
        `;
    } else {
        // Stop or Pause
        const emoji = type === 'pause' ? '⏸️' : '🛑';
        const action = type === 'pause' ? 'Paused Task' : 'Stopped Task';
        
        message = `
<b>${emoji} User ${action}</b>
👤 <b>User:</b> ${userName}
📂 <b>Project:</b> ${projectName}
TB <b>Task:</b> ${taskName}
⏱️ <b>Duration:</b> ${duration}
⏰ <b>Start:</b> ${startStr}
🏁 <b>End:</b> ${now}${linkHtml}
        `;
    }

    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true 
            })
        });
    } catch (error) {
        console.error("Failed to send Telegram notification", error);
    }
};

// --- FORMATTER ---
const formatDuration = (ms) => {
    if (ms < 0) ms = 0;
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    return `${hh}:${mm}:${ss}`;
};

// --- LIVE TIMER COMPONENT ---
const LiveDuration = ({ startTime, isPaused }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!startTime) return;
        const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
        const tick = () => setElapsed(new Date() - start);
        tick(); 
        const interval = setInterval(tick, 1000); 
        return () => clearInterval(interval);
    }, [startTime]);

    return (
        <span className={`font-mono text-sm font-bold ${isPaused ? 'text-orange-500' : 'text-green-600'}`}>
            {isPaused ? 'Paused: ' : ''}{formatDuration(elapsed)}
        </span>
    );
};

const HandoverPopup = ({ teamId, handoverId, onClose, membersDetails = [], currentUserUid }) => {
  const { t } = useContext(LanguageContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dynamic Telegram Chat ID State
  const [telegramChatId, setTelegramChatId] = useState(null);

  // Task State
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('Medium'); 
  
  // Comment State
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  
  // Active Work Session
  const [activeSession, setActiveSession] = useState(null);

  const [isCreator, setIsCreator] = useState(false);
  const messagesEndRef = useRef(null);

  const resolveName = (uid) => {
    if (!uid) return 'Unknown';
    const member = membersDetails.find(m => m.uid === uid);
    if (member) return member.displayName || member.email;
    return uid;
  };

  // 1. Fetch Project Data & Team Config
  useEffect(() => {
    if (!teamId || !handoverId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // A. Fetch Handover Data
        const docRef = doc(db, 'teams', teamId, 'handovers', handoverId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const docData = docSnap.data();
          setData({ id: docSnap.id, ...docData });
          if (auth.currentUser && docData.createdBy === auth.currentUser.uid) {
              setIsCreator(true);
          }
        }

        // B. Fetch Team Data (Telegram ID)
        const teamRef = doc(db, 'teams', teamId);
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) {
            const teamData = teamSnap.data();
            if (teamData.telegramChatId) {
                setTelegramChatId(teamData.telegramChatId);
            }
        }

      } catch (err) {
        console.error("Error fetching details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teamId, handoverId]);

  // 2. Fetch Comments
  useEffect(() => {
      if(!teamId || !handoverId) return;
      const q = query(
          collection(db, 'teams', teamId, 'handovers', handoverId, 'comments'),
          orderBy('createdAt', 'asc')
      );
      const unsub = onSnapshot(q, (snapshot) => {
          const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setComments(fetchedComments);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      });
      return () => unsub();
  }, [teamId, handoverId]);

  // 3. Monitor Active Work Session
  useEffect(() => {
      if(!currentUserUid || !teamId || !handoverId) return;
      const q = query(
          collection(db, 'teams', teamId, 'workLogs'),
          where('userId', '==', currentUserUid),
          where('handoverId', '==', handoverId),
          where('status', 'in', ['active', 'paused']) 
      );
      const unsub = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
              const docData = snapshot.docs[0].data();
              setActiveSession({ id: snapshot.docs[0].id, ...docData });
          } else {
              setActiveSession(null);
          }
      });
      return () => unsub();
  }, [teamId, handoverId, currentUserUid]);


  // --- ACTIONS ---

  const handleAddTask = async (e) => {
      e.preventDefault();
      if (!newTaskName.trim()) return;

      const newTask = {
          id: Date.now().toString(), 
          title: newTaskName,
          priority: newTaskPriority,
          status: 'Open',
          createdAt: new Date().toISOString()
      };

      try {
          const docRef = doc(db, 'teams', teamId, 'handovers', handoverId);
          await updateDoc(docRef, { projectTasks: arrayUnion(newTask) });
          setData(prev => ({ ...prev, projectTasks: [...(prev.projectTasks || []), newTask] }));
          
          // --- SEND TELEGRAM ---
          const currentUser = auth.currentUser;
          const userName = currentUser?.displayName || currentUser?.email || 'Unknown';
          const projectName = data?.title || 'Untitled Project';
          // Construct Link
          const projectUrl = `${window.location.origin}/team/${teamId}`;

          sendTelegramNotification(telegramChatId, 'create_task', {
              userName,
              projectName,
              taskName: newTaskName,
              priority: newTaskPriority,
              projectUrl: projectUrl 
          });

          // Reset Form
          setNewTaskName('');
          setNewTaskPriority('Medium');
      } catch (err) {
          console.error("Error adding task:", err);
      }
  };

  const handleDeleteTask = async (taskToDelete) => {
      if (!window.confirm("Are you sure you want to delete this task?")) return;

      try {
          const docRef = doc(db, 'teams', teamId, 'handovers', handoverId);
          const updatedTasks = data.projectTasks.filter(t => t.id !== taskToDelete.id);
          
          await updateDoc(docRef, { projectTasks: updatedTasks });
          setData(prev => ({ ...prev, projectTasks: updatedTasks }));

      } catch (err) {
          console.error("Error deleting task:", err);
      }
  };

  const handlePostComment = async (e) => {
      e.preventDefault();
      if(!newComment.trim() || !currentUserUid) return;
      
      const currentUser = auth.currentUser;
      const userName = currentUser?.displayName || currentUser?.email || 'Unknown';

      try {
          await addDoc(collection(db, 'teams', teamId, 'handovers', handoverId, 'comments'), {
              text: newComment,
              userId: currentUserUid,
              userName: userName,
              createdAt: serverTimestamp()
          });
          setNewComment('');
      } catch (err) {
          console.error("Error posting comment:", err);
      }
  };

  // --- TOGGLE WORK LOGIC WITH TELEGRAM INTEGRATION ---
  const handleToggleWork = async (taskId, taskTitle, actionType = 'start') => {
      if(!currentUserUid) return;
      const currentUser = auth.currentUser;
      const userName = currentUser?.displayName || currentUser?.email || 'Unknown';
      const projectName = data?.title || 'Untitled Project';
      
      // Construct Link
      const projectUrl = `${window.location.origin}/team/${teamId}`;

      try {
          // If we have an existing session (active or paused)
          if (activeSession) {
              
              // 1. Close current session
              const logRef = doc(db, 'teams', teamId, 'workLogs', activeSession.id);
              
              let historyLabel = '';
              if (activeSession.status === 'active') {
                  historyLabel = actionType === 'pause' ? `Paused: ${taskTitle}` : `Stopped: ${taskTitle}`;
              } else {
                  historyLabel = actionType === 'resume' ? `Resumed: ${taskTitle}` : `Stopped (was paused): ${taskTitle}`;
              }

              // Calculate duration for Telegram
              let durationStr = "00:00:00";
              const startTimeDate = activeSession.startTime?.toDate ? activeSession.startTime.toDate() : new Date(activeSession.startTime);
              const endTimeDate = new Date();
              const diff = endTimeDate - startTimeDate;
              durationStr = formatDuration(diff);

              await updateDoc(logRef, {
                  endTime: serverTimestamp(),
                  status: 'completed',
                  action: historyLabel
              });

              // --- SEND TELEGRAM: STOP or PAUSE ---
              if(actionType === 'pause' || actionType === 'stop') {
                  sendTelegramNotification(telegramChatId, actionType, {
                      userName,
                      projectName,
                      taskName: activeSession.taskTitle,
                      startTime: startTimeDate,
                      duration: durationStr,
                      projectUrl: projectUrl 
                  });
              }

              // 2. Open NEW session
              if (actionType === 'pause') {
                  await addDoc(collection(db, 'teams', teamId, 'workLogs'), {
                      type: 'status',
                      action: `Paused: ${taskTitle}`,
                      userName: userName,
                      userId: currentUserUid,
                      handoverId: handoverId,
                      taskId: taskId,
                      taskTitle: taskTitle,
                      startTime: serverTimestamp(),
                      status: 'paused',
                      createdAt: serverTimestamp()
                  });
              } else if (actionType === 'resume') {
                  await addDoc(collection(db, 'teams', teamId, 'workLogs'), {
                      type: 'task',
                      action: `Resumed: ${taskTitle}`,
                      userName: userName,
                      userId: currentUserUid,
                      handoverId: handoverId,
                      taskId: taskId,
                      taskTitle: taskTitle,
                      startTime: serverTimestamp(),
                      status: 'active',
                      createdAt: serverTimestamp()
                  });
                  // Send Telegram Resume
                  sendTelegramNotification(telegramChatId, 'resume', { 
                      userName, projectName, taskName: taskTitle, projectUrl 
                  });

              } else if (activeSession.taskId !== taskId && actionType === 'start') {
                  // Switching Tasks
                  await addDoc(collection(db, 'teams', teamId, 'workLogs'), {
                      type: 'task',
                      action: `Started: ${taskTitle}`,
                      userName: userName,
                      userId: currentUserUid,
                      handoverId: handoverId,
                      taskId: taskId,
                      taskTitle: taskTitle,
                      startTime: serverTimestamp(),
                      status: 'active',
                      createdAt: serverTimestamp()
                  });
                  // Send Telegram Start
                  sendTelegramNotification(telegramChatId, 'start', { 
                      userName, projectName, taskName: taskTitle, projectUrl 
                  });
              }

          } else {
              // No current session, Start New
              await addDoc(collection(db, 'teams', teamId, 'workLogs'), {
                  type: 'task',
                  action: `Started: ${taskTitle}`,
                  userName: userName,
                  userId: currentUserUid,
                  handoverId: handoverId,
                  taskId: taskId,
                  taskTitle: taskTitle,
                  startTime: serverTimestamp(),
                  status: 'active',
                  createdAt: serverTimestamp()
              });
              // Send Telegram Start
              sendTelegramNotification(telegramChatId, 'start', { 
                  userName, projectName, taskName: taskTitle, projectUrl 
              });
          }
      } catch (err) {
          console.error("Error toggling work:", err);
      }
  };

  const getPriorityColor = (p) => {
      switch(p) {
          case 'High': return 'text-red-600 bg-red-50 border-red-200';
          case 'Low': return 'text-gray-600 bg-gray-50 border-gray-200';
          default: return 'text-blue-600 bg-blue-50 border-blue-200';
      }
  };

  if (!teamId || !handoverId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div className="flex items-center gap-4">
             <div>
                 <h3 className="text-lg font-bold text-gray-800 leading-none">
                     {loading ? 'Loading...' : (data?.title || 'Project Details')}
                 </h3>
                 <p className="text-xs text-gray-500 mt-1">
                    Project Container 
                    {telegramChatId && <span className="ml-2 text-green-600 font-bold">• Bot Linked</span>}
                 </p>
             </div>
             {/* ID Display for user to copy for the bot command */}
             <div className="hidden sm:flex bg-gray-100 px-2 py-1 rounded border text-[10px] text-gray-500 gap-1 items-center" title="Copy ID for Bot">
                <span>ID: {teamId}</span>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 bg-white rounded-full p-1 shadow-sm">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-0 flex flex-col md:flex-row h-full">
          
          {/* LEFT: Main Details & Tasks */}
          <div className="flex-1 p-6 border-r border-gray-100 flex flex-col overflow-y-auto custom-scrollbar">
             {!loading && data && (
                <div className="space-y-6">
                  {/* Description */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-gray-700">
                      {data.description || 'No description provided.'}
                  </div>

                  {/* Task List */}
                  <div className="mt-4">
                      <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex justify-between items-center">
                          Tasks
                      </h4>

                      {isCreator && (
                          <form onSubmit={handleAddTask} className="flex gap-2 mb-4 bg-gray-50 p-2 rounded border border-gray-200">
                              <input 
                                type="text" 
                                value={newTaskName}
                                onChange={(e) => setNewTaskName(e.target.value)}
                                placeholder="New task..."
                                className="flex-1 border rounded px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                              />
                              <select 
                                value={newTaskPriority} 
                                onChange={(e) => setNewTaskPriority(e.target.value)}
                                className="border rounded px-2 py-1.5 text-sm bg-white"
                              >
                                  <option value="High">High</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Low">Low</option>
                              </select>
                              <button type="submit" disabled={!newTaskName.trim()} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Add</button>
                          </form>
                      )}

                      <div className="space-y-2">
                          {data.projectTasks && data.projectTasks.length > 0 ? (
                              data.projectTasks.map((task) => {
                                  // Determine if this specific task is the one in the session
                                  const isSessionTask = activeSession && activeSession.taskId === task.id;
                                  
                                  // Determine status: 'active', 'paused', or null
                                  const sessionStatus = isSessionTask ? activeSession.status : null;
                                  
                                  const isActive = sessionStatus === 'active';
                                  const isPaused = sessionStatus === 'paused';
                                  
                                  return (
                                      <div key={task.id} className={`flex items-center justify-between p-3 rounded border ${isSessionTask ? (isPaused ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200 shadow-sm') : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                          <div className="flex items-center gap-3">
                                              <span className={`text-xs px-2 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                                                  {task.priority}
                                              </span>
                                              <span className={`text-sm font-medium ${isSessionTask ? 'text-gray-900' : 'text-gray-700'}`}>{task.title}</span>
                                              
                                              {/* DELETE TASK BUTTON (Only for Creator) */}
                                              {isCreator && (
                                                  <button 
                                                      onClick={() => handleDeleteTask(task)}
                                                      className="text-gray-300 hover:text-red-500 ml-2"
                                                      title="Delete Task"
                                                  >
                                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                  </button>
                                              )}
                                          </div>
                                          <div className="flex items-center gap-3">
                                              {isSessionTask && <LiveDuration startTime={activeSession.startTime} isPaused={isPaused} />}
                                              
                                              {/* Logic for Buttons */}
                                              {isActive && (
                                                  <div className="flex gap-1">
                                                      <button 
                                                        onClick={() => handleToggleWork(task.id, task.title, 'pause')}
                                                        className="px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 bg-yellow-100 text-yellow-700 border border-yellow-200 hover:bg-yellow-200"
                                                        title="Pause Timer"
                                                      >
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                        Pause
                                                      </button>
                                                      <button 
                                                        onClick={() => handleToggleWork(task.id, task.title, 'stop')}
                                                        className="px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 hover:bg-red-200"
                                                        title="Stop Work"
                                                      >
                                                        <span className="w-2 h-2 bg-red-500 rounded-sm"></span>
                                                        Stop
                                                      </button>
                                                  </div>
                                              )}

                                              {isPaused && (
                                                   <div className="flex gap-1">
                                                      <button 
                                                        onClick={() => handleToggleWork(task.id, task.title, 'resume')}
                                                        className="px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 bg-green-100 text-green-700 border border-green-200 hover:bg-green-200"
                                                        title="Resume Work"
                                                      >
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg> 
                                                        Resume
                                                      </button>
                                                      <button 
                                                        onClick={() => handleToggleWork(task.id, task.title, 'stop')}
                                                        className="px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 hover:bg-red-200"
                                                        title="Stop Work"
                                                      >
                                                        <span className="w-2 h-2 bg-red-500 rounded-sm"></span>
                                                        Stop
                                                      </button>
                                                   </div>
                                              )}

                                              {!isSessionTask && (
                                                  <button 
                                                    onClick={() => handleToggleWork(task.id, task.title, 'start')}
                                                    className="px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 bg-white border-gray-300 text-gray-700 border hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                                                  >
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg> 
                                                    Start
                                                  </button>
                                              )}
                                          </div>
                                      </div>
                                  );
                              })
                          ) : (
                              <p className="text-sm text-gray-400 italic text-center py-4">No tasks yet.</p>
                          )}
                      </div>
                  </div>
                </div>
             )}
          </div>

          {/* RIGHT: History & Comments */}
          <div className="w-full md:w-80 flex flex-col border-t md:border-t-0 md:border-l border-gray-200 bg-gray-50 h-full">
              
              {/* History Section (Top 40%) */}
              <div className="flex-shrink-0 h-1/3 border-b border-gray-200 p-4 overflow-y-auto">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 sticky top-0 bg-gray-50 pb-2">Recent Activity</h4>
                  {!loading && data && (
                     <div className="space-y-4 relative pl-3 border-l-2 border-gray-200">
                        <div className="relative">
                           <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-gray-400"></div>
                           <p className="text-xs text-gray-500">Project Created</p>
                           <p className="text-[10px] text-gray-400">{new Date(data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt).toLocaleString()}</p>
                           <p className="text-[10px] text-gray-500 mt-0.5">by {resolveName(data.postedBy)}</p>
                        </div>
                     </div>
                  )}
              </div>

              {/* Comments Section (Bottom 60%) */}
              <div className="flex-1 flex flex-col bg-white">
                  <div className="p-3 bg-gray-50 border-b border-gray-200">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Comments</h4>
                  </div>
                  
                  {/* Message List */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {comments.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center mt-4">No comments yet.</p>
                      ) : (
                          comments.map((msg) => (
                              <div key={msg.id} className="text-sm">
                                  <div className="flex justify-between items-baseline mb-1">
                                      <span className="font-bold text-gray-800 text-xs">{msg.userName}</span>
                                      <span className="text-[10px] text-gray-400">
                                          {msg.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </span>
                                  </div>
                                  <div className="bg-gray-100 p-2 rounded-lg text-gray-700 break-words">
                                      {msg.text}
                                  </div>
                              </div>
                          ))
                      )}
                      <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <form onSubmit={handlePostComment} className="p-3 border-t border-gray-200">
                      <div className="flex gap-2">
                          <input 
                            className="flex-1 border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                            placeholder="Type a comment..."
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                          />
                          <button 
                            type="submit" 
                            disabled={!newComment.trim()}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                          >
                            Post
                          </button>
                      </div>
                  </form>
              </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-100 font-medium text-sm">
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HandoverPopup;