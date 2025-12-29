// src/components/HandoverPopup.jsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import { db, auth } from '../firebaseConfig';
import { 
  doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, 
  query, where, onSnapshot, orderBy 
} from 'firebase/firestore'; 
import { LanguageContext } from '../contexts/LanguageContext';

// --- CONFIGURATION ---
const TELEGRAM_BOT_TOKEN = '8204073221:AAEuEMTZoeRAPBx0IjkSc-ZafHjiTMarb6g'; 

// --- ICONS ---
const PaperClipIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>;
const LinkIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;

// --- TELEGRAM HELPER (Kept Same) ---
const sendTelegramNotification = async (chatId, type, details) => {
    if (!TELEGRAM_BOT_TOKEN || !chatId) return;
    const { userName, projectName, taskName, duration, projectUrl, notes, fileCount } = details;
    const now = new Date().toLocaleString();
    const linkHtml = projectUrl ? `\n\n🔗 ${projectUrl}` : '';
    let message = '';
    switch (type) {
        case 'start':
        case 'resume':
            const emojiStart = type === 'resume' ? '▶️' : '🚀';
            message = `<b>${emojiStart} User ${type === 'resume' ? 'Resumed' : 'Started'} Task</b>\n👤 <b>User:</b> ${userName}\n📂 <b>Project:</b> ${projectName}\n📝 <b>Task:</b> ${taskName}\n⏰ <b>Time:</b> ${now}${linkHtml}`;
            break;
        case 'submit':
            message = `<b>✋ Task Submitted for QA</b>\n👤 <b>User:</b> ${userName}\n📂 <b>Project:</b> ${projectName}\n📝 <b>Task:</b> ${taskName}\n⏱️ <b>Duration:</b> ${duration}\n📄 <b>Notes:</b> ${notes || 'No notes.'}\n📎 <b>Files/Images:</b> ${fileCount || 0}${linkHtml}`;
            break;
        case 'completed':
            message = `<b>✅ Task Approved & Completed</b>\n👤 <b>Approver:</b> ${userName}\n📂 <b>Project:</b> ${projectName}\n📝 <b>Task:</b> ${taskName}${linkHtml}`;
            break;
        case 'revision':
            message = `<b>↩️ Revision Requested</b>\n👤 <b>Reviewer:</b> ${userName}\n📂 <b>Project:</b> ${projectName}\n📝 <b>Task:</b> ${taskName}${linkHtml}`;
            break;
        case 'pause':
            message = `<b>⏸️ User Paused Task</b>\n👤 <b>User:</b> ${userName}\n📂 <b>Project:</b> ${projectName}\n📝 <b>Task:</b> ${taskName}\n⏱️ <b>Duration:</b> ${duration}${linkHtml}`;
            break;
        default: break;
    }
    if (message) {
        try {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: true })
            });
        } catch (error) { console.error("Failed to send Telegram notification", error); }
    }
};

const formatDuration = (ms) => {
    if (ms < 0) ms = 0;
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

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
    return <span className={`font-mono text-xl font-bold ${isPaused ? 'text-orange-500' : 'text-green-600'}`}>{isPaused ? 'Paused: ' : ''}{formatDuration(elapsed)}</span>;
};

// --- MAIN COMPONENT ---
const HandoverPopup = ({ teamId, handoverId, taskId, onClose, membersDetails = [], currentUserUid }) => {
  const { t } = useContext(LanguageContext);
  const [projectData, setProjectData] = useState(null);
  const [taskData, setTaskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [telegramChatId, setTelegramChatId] = useState(null);

  // --- COMMENTS ---
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const messagesEndRef = useRef(null);

  // --- ACTIVE SESSION ---
  const [activeSession, setActiveSession] = useState(null);

  // --- SUBMISSION MODAL ---
  const [submissionModal, setSubmissionModal] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionImages, setSubmissionImages] = useState([]); 
  const [submissionFiles, setSubmissionFiles] = useState([]); 

  const [isCreator, setIsCreator] = useState(false);

  const resolveName = (uid) => {
    if (!uid) return 'Unknown';
    const member = membersDetails.find(m => m.uid === uid);
    return member ? (member.displayName || member.email) : uid;
  };

  // 1. Fetch Project & Find Task
  useEffect(() => {
    if (!teamId || !handoverId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'teams', teamId, 'handovers', handoverId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const d = docSnap.data();
          setProjectData({ id: docSnap.id, ...d });
          if (auth.currentUser && d.createdBy === auth.currentUser.uid) setIsCreator(true);
          
          // Find Specific Task
          const foundTask = d.projectTasks?.find(t => t.id === taskId);
          setTaskData(foundTask || null);
        }
        const teamRef = doc(db, 'teams', teamId);
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists() && teamSnap.data().telegramChatId) setTelegramChatId(teamSnap.data().telegramChatId);
      } catch (err) { console.error("Error fetching details:", err); } finally { setLoading(false); }
    };
    fetchData();
  }, [teamId, handoverId, taskId]);

  // 2. Fetch Project Comments (We still show project chat for context)
  useEffect(() => {
      if(!teamId || !handoverId) return;
      const q = query(collection(db, 'teams', teamId, 'handovers', handoverId, 'comments'), orderBy('createdAt', 'asc'));
      const unsub = onSnapshot(q, (snapshot) => {
          setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      });
      return () => unsub();
  }, [teamId, handoverId]);

  // 3. Monitor Active Session
  useEffect(() => {
      if(!currentUserUid || !teamId || !handoverId) return;
      const q = query(collection(db, 'teams', teamId, 'workLogs'), where('userId', '==', currentUserUid), where('handoverId', '==', handoverId), where('status', 'in', ['active', 'paused']));
      const unsub = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) setActiveSession({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
          else setActiveSession(null);
      });
      return () => unsub();
  }, [teamId, handoverId, currentUserUid]);

  // --- ACTIONS ---
  const handleUpdateTaskStatus = async (newStatus, additionalData = {}) => {
      try {
          const docRef = doc(db, 'teams', teamId, 'handovers', handoverId);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) return;
          
          let tasks = docSnap.data().projectTasks || [];
          const taskIndex = tasks.findIndex(t => t.id === taskId);
          if (taskIndex === -1) return;

          tasks[taskIndex].status = newStatus;
          if (Object.keys(additionalData).length > 0) tasks[taskIndex] = { ...tasks[taskIndex], ...additionalData };

          await updateDoc(docRef, { projectTasks: tasks });
          setTaskData({ ...tasks[taskIndex] }); // Update local state
      } catch (err) { console.error("Error updating status:", err); }
  };

  const handleToggleWork = async (actionType) => {
      if(!currentUserUid || !taskData) return;
      const userName = auth.currentUser?.displayName || 'Unknown';
      const projectUrl = `${window.location.origin}/team/${teamId}`;

      try {
          if (actionType === 'start' || actionType === 'resume') handleUpdateTaskStatus('In Progress');

          if (activeSession) {
              const logRef = doc(db, 'teams', teamId, 'workLogs', activeSession.id);
              const endTime = new Date();
              const startTime = activeSession.startTime?.toDate ? activeSession.startTime.toDate() : new Date(activeSession.startTime);
              const durationStr = formatDuration(endTime - startTime);
              await updateDoc(logRef, { endTime: serverTimestamp(), status: 'completed', action: actionType === 'pause' ? 'Paused' : 'Stopped' });
              
              if (actionType === 'pause') sendTelegramNotification(telegramChatId, 'pause', { userName, projectName: projectData.title, taskName: taskData.title, duration: durationStr, projectUrl });
          }

          if (actionType === 'start' || actionType === 'resume') {
              await addDoc(collection(db, 'teams', teamId, 'workLogs'), {
                  type: 'task', action: 'Working', userName, userId: currentUserUid, handoverId, taskId, taskTitle: taskData.title, startTime: serverTimestamp(), status: 'active', createdAt: serverTimestamp()
              });
              sendTelegramNotification(telegramChatId, actionType, { userName, projectName: projectData.title, taskName: taskData.title, projectUrl });
          }
      } catch (err) { console.error("Error toggling work:", err); }
  };

  const handleConfirmSubmit = async () => {
      const userName = auth.currentUser?.displayName || 'Unknown';
      
      if (activeSession) {
          const logRef = doc(db, 'teams', teamId, 'workLogs', activeSession.id);
          const endTime = new Date();
          const startTime = activeSession.startTime?.toDate ? activeSession.startTime.toDate() : new Date(activeSession.startTime);
          const durationStr = formatDuration(endTime - startTime);
          await updateDoc(logRef, { endTime: serverTimestamp(), status: 'completed', action: 'Submitted' });
          sendTelegramNotification(telegramChatId, 'submit', { userName, projectName: projectData.title, taskName: taskData.title, duration: durationStr, notes: submissionNote, fileCount: submissionImages.length + submissionFiles.length, projectUrl: `${window.location.origin}/team/${teamId}` });
      } else {
          sendTelegramNotification(telegramChatId, 'submit', { userName, projectName: projectData.title, taskName: taskData.title, duration: 'N/A', notes: submissionNote, fileCount: submissionImages.length + submissionFiles.length, projectUrl: `${window.location.origin}/team/${teamId}` });
      }

      await handleUpdateTaskStatus('QA', {
          submission: {
              note: submissionNote,
              images: submissionImages,
              files: submissionFiles,
              submittedBy: currentUserUid,
              submittedAt: new Date().toISOString()
          }
      });
      setSubmissionModal(false);
  };

  const processPaste = (e, setImagesFunc) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
              const blob = items[i].getAsFile();
              const reader = new FileReader();
              reader.onload = (evt) => setImagesFunc(prev => [...prev, evt.target.result]);
              reader.readAsDataURL(blob);
          }
      }
  };

  const handleFileUpload = (e, setFilesFunc) => {
      const files = Array.from(e.target.files);
      files.forEach(file => {
          const reader = new FileReader();
          reader.onload = (evt) => setFilesFunc(prev => [...prev, { name: file.name, data: evt.target.result, type: file.type }]);
          reader.readAsDataURL(file);
      });
  };

  // --- HELPERS ---
  const getStatusColor = (status) => {
      switch(status) {
          case 'In Progress': return 'bg-blue-100 text-blue-700';
          case 'QA': return 'bg-purple-100 text-purple-700';
          case 'Completed': return 'bg-green-100 text-green-700';
          default: return 'bg-gray-100 text-gray-600';
      }
  };

  if (!teamId || !handoverId || !taskId) return null;

  const isAssigned = taskData && ( (Array.isArray(taskData.assignedTo) && taskData.assignedTo.includes(currentUserUid)) || isCreator );
  const isActive = activeSession && activeSession.taskId === taskId && activeSession.status === 'active';
  const isPaused = activeSession && activeSession.taskId === taskId && activeSession.status === 'paused';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-white">
          <div>
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide">{projectData?.title || 'Project'}</h3>
             <h2 className="text-xl font-extrabold text-slate-800">{loading ? 'Loading...' : (taskData?.title || 'Task Details')}</h2>
          </div>
          <button onClick={onClose} className="bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 p-2 rounded-full transition-all">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-50">
          
          {/* LEFT: TASK DETAILS */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col">
             
             {!loading && taskData ? (
                 <div className="space-y-8">
                     
                     {/* 1. Status Bar & Actions */}
                     <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                         <div className="flex items-center gap-3">
                             <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusColor(taskData.status)}`}>{taskData.status}</span>
                             <span className={`px-3 py-1 rounded-full text-xs font-bold border ${taskData.priority === 'High' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{taskData.priority}</span>
                         </div>
                         
                         {/* TIMER & CONTROLS */}
                         {isAssigned && taskData.status !== 'Completed' && (
                             <div className="flex items-center gap-3">
                                 {isActive && <LiveDuration startTime={activeSession.startTime} isPaused={false} />}
                                 {isPaused && <span className="text-orange-500 font-mono font-bold">Paused</span>}
                                 
                                 {(!isActive && !isPaused) && (
                                     <button onClick={() => handleToggleWork('start')} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-green-500/30 hover:bg-green-700 transition">Start Work</button>
                                 )}
                                 {isPaused && (
                                     <button onClick={() => handleToggleWork('resume')} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition">Resume</button>
                                 )}
                                 {isActive && (
                                     <>
                                        <button onClick={() => handleToggleWork('pause')} className="bg-amber-100 text-amber-700 px-4 py-2 rounded-lg font-bold hover:bg-amber-200">Pause</button>
                                        <button onClick={() => setSubmissionModal(true)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700">Submit</button>
                                     </>
                                 )}
                             </div>
                         )}
                     </div>

                     {/* 2. Description */}
                     <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Description</h4>
                         <div className="prose prose-sm text-slate-700 whitespace-pre-wrap">{taskData.description || 'No description provided.'}</div>
                     </div>

                     {/* 3. Attachments */}
                     {( (taskData.images && taskData.images.length > 0) || (taskData.files && taskData.files.length > 0) || (taskData.links && taskData.links.length > 0) ) && (
                         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><PaperClipIcon /> Resources</h4>
                             
                             {/* Links */}
                             {taskData.links?.length > 0 && (
                                 <div className="mb-4 flex flex-col gap-2">
                                     {taskData.links.map((link, i) => (
                                         <a key={i} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline text-sm bg-blue-50 p-2 rounded"><LinkIcon /> {link}</a>
                                     ))}
                                 </div>
                             )}

                             {/* Files Grid */}
                             <div className="flex gap-4 flex-wrap">
                                 {taskData.images?.map((img, i) => <img key={i} src={img} className="h-24 w-24 object-cover rounded-lg border shadow-sm cursor-pointer hover:scale-105 transition" onClick={() => window.open(img)} />)}
                                 {taskData.files?.map((f, i) => (
                                    <div key={i} className="h-24 w-24 bg-slate-50 border rounded-lg flex flex-col items-center justify-center p-2 text-center">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase line-clamp-2">{f.name}</span>
                                        <span className="text-[9px] text-slate-400 mt-1">FILE</span>
                                    </div>
                                 ))}
                             </div>
                         </div>
                     )}

                     {/* 4. Submission Info (If QA) */}
                     {taskData.submission && (
                        <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                             <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs font-bold text-purple-700 uppercase">Submission by {resolveName(taskData.submission.submittedBy)}</span>
                                <span className="text-[10px] text-purple-400">{new Date(taskData.submission.submittedAt).toLocaleString()}</span>
                             </div>
                             <p className="text-sm text-slate-700 mb-4 whitespace-pre-wrap">{taskData.submission.note}</p>
                             <div className="flex gap-3 overflow-x-auto">
                                {taskData.submission.images?.map((img, i) => <img key={i} src={img} className="h-20 w-20 object-cover rounded border" />)}
                             </div>
                             
                             {/* ADMIN ACTIONS FOR QA */}
                             {isCreator && taskData.status === 'QA' && (
                                 <div className="flex gap-3 mt-4 pt-4 border-t border-purple-200">
                                     <button onClick={() => { if(window.confirm("Request Revision?")) handleUpdateTaskStatus('Revision'); }} className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded font-bold text-xs hover:bg-red-50">Request Revision</button>
                                     <button onClick={() => { if(window.confirm("Approve?")) handleUpdateTaskStatus('Completed'); }} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold text-xs hover:bg-emerald-700 shadow-sm">Approve & Complete</button>
                                 </div>
                             )}
                        </div>
                     )}

                 </div>
             ) : <div className="text-center py-20 text-slate-400">Task not found</div>}
          </div>

          {/* RIGHT: CHAT (Project Context) */}
          <div className="w-full lg:w-[350px] border-l border-slate-200 bg-white flex flex-col h-full shadow-lg z-20">
               <div className="p-4 bg-slate-50 border-b border-slate-200">
                   <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Discussion</h4>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                  {comments.map((msg) => (
                      <div key={msg.id} className="group">
                          <div className="flex justify-between items-baseline mb-1 px-1">
                              <span className="font-bold text-slate-700 text-xs">{msg.userName}</span>
                              <span className="text-[10px] text-slate-400">{msg.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 text-slate-600 text-sm shadow-sm break-words">
                              {msg.text}
                          </div>
                      </div>
                  ))}
                  <div ref={messagesEndRef} />
               </div>

               {/* CHAT INPUT */}
               <form onSubmit={(e) => { e.preventDefault(); if(!newComment.trim()) return; addDoc(collection(db, 'teams', teamId, 'handovers', handoverId, 'comments'), { text: newComment, userId: auth.currentUser.uid, userName: auth.currentUser.displayName || 'Unknown', createdAt: serverTimestamp() }); setNewComment(''); }} className="p-3 border-t border-slate-200 bg-white flex gap-2">
                   <input className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Type a message..." value={newComment} onChange={e => setNewComment(e.target.value)} />
                   <button type="submit" disabled={!newComment.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition">Send</button>
               </form>
          </div>
        </div>
      </div>

      {/* --- SUBMISSION MODAL (Overlay) --- */}
      {submissionModal && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-fade-in-up flex flex-col max-h-[90vh]">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Submit Work</h3>
                <div className="flex-1 overflow-y-auto space-y-4">
                    <textarea className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-32" placeholder="Notes... (Paste images Ctrl+V)" value={submissionNote} onChange={(e) => setSubmissionNote(e.target.value)} onPaste={(e) => processPaste(e, setSubmissionImages)}></textarea>
                    
                    <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Attachments</label>
                         <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50">
                            <span className="text-xs text-slate-500">Upload Files</span>
                            <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, setSubmissionFiles)} />
                        </label>
                        <div className="flex gap-2 mt-2 flex-wrap">
                            {submissionImages.map((img, i) => <img key={i} src={img} className="h-10 w-10 object-cover rounded border" />)}
                            {submissionFiles.map((f, i) => <div key={i} className="px-2 py-1 bg-gray-100 rounded text-[10px] border">{f.name}</div>)}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t mt-2">
                    <button onClick={() => setSubmissionModal(false)} className="px-4 py-2 text-slate-600 font-bold text-sm">Cancel</button>
                    <button onClick={handleConfirmSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700">Confirm Submit</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default HandoverPopup;