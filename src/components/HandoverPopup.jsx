// src/components/HandoverPopup.jsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import { db, auth } from '../firebaseConfig';
import { 
  doc, updateDoc, addDoc, collection, serverTimestamp, 
  query, orderBy, onSnapshot, where
} from 'firebase/firestore'; 
import { LanguageContext } from '../contexts/LanguageContext';

// --- ICONS ---
const PaperClipIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>;
const LinkIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;
const ExclamationIcon = () => <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
const FileIcon = () => <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const CloseIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

// --- HELPER: DURATION FORMATTER ---
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
        setElapsed(new Date() - start);
        const interval = setInterval(() => { setElapsed(new Date() - start); }, 1000); 
        return () => clearInterval(interval);
    }, [startTime]);
    return <span className={`font-mono text-xl font-bold ${isPaused ? 'text-orange-500' : 'text-green-600'}`}>{isPaused ? 'Paused: ' : ''}{formatDuration(elapsed)}</span>;
};

const HandoverPopup = ({ teamId, handoverId, taskId, onClose, membersDetails = [], currentUserUid }) => {
  const { t } = useContext(LanguageContext);
  const [projectData, setProjectData] = useState(null);
  const [taskData, setTaskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const messagesEndRef = useRef(null);
  const [activeSession, setActiveSession] = useState(null);
  
  // Modals
  const [submissionModal, setSubmissionModal] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionImages, setSubmissionImages] = useState([]); 
  const [submissionFiles, setSubmissionFiles] = useState([]); 
  const [revisionModal, setRevisionModal] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [previewImage, setPreviewImage] = useState(null); 
  
  // Derived state for creator
  const [isCreator, setIsCreator] = useState(false);

  // --- 1. RESOLVE NAME CORRECTLY (Fixes "Unknown") ---
  const resolveCurrentName = () => {
    // 1. Try Firebase Auth Profile
    if (auth.currentUser?.displayName) return auth.currentUser.displayName;
    // 2. Try Members List Lookup
    const member = membersDetails.find(m => m.uid === currentUserUid);
    return member ? (member.displayName || member.email) : 'Unknown User';
  };

  const resolveName = (uid) => {
    if (!uid) return 'Unknown';
    const member = membersDetails.find(m => m.uid === uid);
    return member ? (member.displayName || member.email) : 'Unknown User';
  };

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!teamId || !handoverId) return;
    setLoading(true);

    const docRef = doc(db, 'teams', teamId, 'handovers', handoverId);
    
    // Listen to Project/Task Changes
    const unsubProject = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const d = docSnap.data();
            setProjectData({ id: docSnap.id, ...d });
            
            if (currentUserUid && d.postedBy === currentUserUid) setIsCreator(true);
            else if (currentUserUid && d.createdBy === currentUserUid) setIsCreator(true);
            else setIsCreator(false);

            const foundTask = d.projectTasks?.find(t => t.id === taskId || String(t.taskNumber) === String(taskId));
            setTaskData(foundTask || null);
        }
        setLoading(false);
    });

    return () => unsubProject();
  }, [teamId, handoverId, taskId, currentUserUid]);

  // Listen to Comments Subcollection
  useEffect(() => {
      if(!teamId || !handoverId) return;
      const q = query(collection(db, 'teams', teamId, 'handovers', handoverId, 'comments'), orderBy('createdAt', 'asc'));
      const unsub = onSnapshot(q, (snapshot) => {
          setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      });
      return () => unsub();
  }, [teamId, handoverId]);

  // Listen to Work Logs
  useEffect(() => {
      if(!currentUserUid || !teamId || !handoverId) return;
      const q = query(
        collection(db, 'teams', teamId, 'workLogs'),
        where('userId', '==', currentUserUid),
        where('handoverId', '==', handoverId),
        where('status', 'in', ['active', 'paused'])
      );
      const unsub = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) setActiveSession({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
          else setActiveSession(null);
      });
      return () => unsub();
  }, [teamId, handoverId, currentUserUid]);

  const handleUpdateTaskStatus = async (newStatus, additionalData = {}) => {
      try {
          const docRef = doc(db, 'teams', teamId, 'handovers', handoverId);
          const latestSnap = await import('firebase/firestore').then(({getDoc}) => getDoc(docRef));
          
          if (!latestSnap.exists()) return;
          
          let tasks = latestSnap.data().projectTasks || [];
          const taskIndex = tasks.findIndex(t => t.id === taskId || String(t.taskNumber) === String(taskId));
          if (taskIndex === -1) return;
          
          tasks[taskIndex].status = newStatus;
          if (Object.keys(additionalData).length > 0) {
              tasks[taskIndex] = { ...tasks[taskIndex], ...additionalData };
          }
          
          await updateDoc(docRef, { projectTasks: tasks });
      } catch (err) { console.error("Error updating status:", err); }
  };

  const handleToggleWork = async (actionType) => {
      if(!currentUserUid || !taskData) return;
      const userName = resolveCurrentName(); // ✅ FIX: Use resolved name
      
      try {
          if (actionType === 'start' || actionType === 'resume') handleUpdateTaskStatus('In Progress');
          
          if (activeSession) {
              const logRef = doc(db, 'teams', teamId, 'workLogs', activeSession.id);
              const endTime = new Date();
              const startTime = activeSession.startTime?.toDate ? activeSession.startTime.toDate() : new Date(activeSession.startTime);
              const durationStr = formatDuration(endTime - startTime);
              await updateDoc(logRef, { endTime: serverTimestamp(), status: 'completed', action: actionType === 'pause' ? 'Paused' : 'Stopped', durationStr });
          }
          
          if (actionType === 'start' || actionType === 'resume') {
              const logTaskId = taskData.id || taskId;
              await addDoc(collection(db, 'teams', teamId, 'workLogs'), {
                  type: 'task', action: 'Working', userName, userId: currentUserUid, handoverId, taskId: logTaskId, taskTitle: taskData.title, startTime: serverTimestamp(), status: 'active', createdAt: serverTimestamp()
              });
          }
      } catch (err) { console.error("Error toggling work:", err); }
  };

  const handleConfirmSubmit = async () => {
      const userName = resolveCurrentName(); // ✅ FIX
      
      if (activeSession) {
          const logRef = doc(db, 'teams', teamId, 'workLogs', activeSession.id);
          const endTime = new Date();
          const startTime = activeSession.startTime?.toDate ? activeSession.startTime.toDate() : new Date(activeSession.startTime);
          const durationStr = formatDuration(endTime - startTime);
          await updateDoc(logRef, { endTime: serverTimestamp(), status: 'completed', action: 'Submitted', durationStr });
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

  const handleConfirmRevision = async () => {
    if (!revisionReason.trim()) return alert("Please provide a reason.");
    // const userName = resolveCurrentName(); // Not needed for DB write, but good for logs
    await handleUpdateTaskStatus('Revision', { revisionFeedback: { reason: revisionReason, requestedBy: currentUserUid, requestedAt: new Date().toISOString() }}); 
    setRevisionModal(false); setRevisionReason('');
  };

  // --- COMMENT HANDLER ---
  const handleSendComment = async (e) => {
    e.preventDefault();
    if(!newComment.trim()) return;
    
    const userName = resolveCurrentName(); // ✅ FIX

    // 1. Add to Subcollection (Keeps the UI chat working)
    await addDoc(collection(db, 'teams', teamId, 'handovers', handoverId, 'comments'), { 
        text: newComment, 
        userId: currentUserUid, 
        userName: userName, 
        createdAt: serverTimestamp() 
    });

    // 2. Update Task (Triggers the Bot Notification)
    // We append this comment to the task's 'comments' array so the Bot detects a change
    const currentComments = taskData.comments || [];
    const updatedComments = [...currentComments, {
        text: newComment,
        userId: currentUserUid,
        userName: userName,
        createdAt: new Date().toISOString()
    }];

    await handleUpdateTaskStatus(taskData.status, { comments: updatedComments });

    setNewComment('');
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

  const getStatusColor = (status) => {
      switch(status) {
          case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
          case 'QA': return 'bg-purple-100 text-purple-800 border-purple-200';
          case 'Completed': return 'bg-green-100 text-green-800 border-green-200';
          case 'Revision': return 'bg-red-100 text-red-800 border-red-200';
          default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
  };

  if (!teamId || !handoverId || !taskId) return null;

  const isAssigned = taskData && ( (Array.isArray(taskData.assignedTo) && taskData.assignedTo.includes(currentUserUid)) || isCreator );
  const isActive = activeSession && activeSession.taskId === (taskData?.id || taskId) && activeSession.status === 'active';
  const isPaused = activeSession && activeSession.taskId === (taskData?.id || taskId) && activeSession.status === 'paused';
  const isRevision = taskData?.status === 'Revision';
  const isQA = taskData?.status === 'QA';
  const isCompleted = taskData?.status === 'Completed';

  // LOGIC FIX: Workers cannot start work if it's in QA or Completed
  const showWorkerActions = isAssigned && !isCompleted && !isQA;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[92vh] flex flex-col overflow-hidden animate-fade-in-up">
        {/* HEADER */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white">
          <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{projectData?.title || 'Project'}</h3>
              <h2 className="text-xl font-extrabold text-slate-800">{loading ? 'Loading...' : (taskData?.title || 'Task Details')}</h2>
          </div>
          <button onClick={onClose} className="bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 p-2 rounded-full transition-all"><CloseIcon /></button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-50">
          {/* LEFT: MAIN CONTENT */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col">
              {!loading && taskData ? (
                  <div className="space-y-6">
                      {/* STATUS & ACTIONS CARD */}
                      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${getStatusColor(taskData.status)}`}>{taskData.status}</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${taskData.priority === 'High' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{taskData.priority}</span>
                            </div>
                            
                            {/* WORKER ACTIONS (Hidden if QA or Completed) */}
                            {showWorkerActions && (
                                <div className="flex items-center gap-3">
                                    {isActive && <LiveDuration startTime={activeSession.startTime} isPaused={false} />}
                                    {isPaused && <span className="text-orange-500 font-mono font-bold text-lg">Paused</span>}
                                    <div className="flex gap-2">
                                        {(!isActive && !isPaused) && (
                                            <button onClick={() => handleToggleWork('start')} className={`px-6 py-2 rounded-lg font-bold shadow-sm transition flex items-center gap-2 text-white ${isRevision ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20' : 'bg-green-600 hover:bg-green-700 shadow-green-500/20'}`}>
                                                {isRevision ? '🛠️ Start Revision Fix' : '🚀 Start Work'}
                                            </button>
                                        )}
                                        {isPaused && <button onClick={() => handleToggleWork('resume')} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700">Resume</button>}
                                        {isActive && (
                                            <>
                                                <button onClick={() => handleToggleWork('pause')} className="bg-amber-100 text-amber-700 px-4 py-2 rounded-lg font-bold hover:bg-amber-200">Pause</button>
                                                <button onClick={() => setSubmissionModal(true)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700">Submit</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* QA STATUS MESSAGE */}
                            {isQA && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-bold border border-purple-100">
                                    <span>⏳ Under Review</span>
                                </div>
                            )}
                      </div>

                      {/* REVISION ALERT */}
                      {(taskData.status === 'Revision' || taskData.revisionFeedback) && (
                        <div className="bg-red-50 p-5 rounded-lg border border-red-200">
                             <div className="flex items-center gap-2 mb-2"><ExclamationIcon /><span className="text-sm font-bold text-red-700 uppercase">Reviewer Feedback</span></div>
                             <div className="text-slate-700 text-sm whitespace-pre-wrap bg-white p-3 rounded border border-red-100">{taskData.revisionFeedback?.reason || 'No specific feedback provided.'}</div>
                             <div className="mt-2 text-[10px] text-red-400">Requested by {resolveName(taskData.revisionFeedback?.requestedBy)} on {new Date(taskData.revisionFeedback?.requestedAt).toLocaleString()}</div>
                        </div>
                      )}

                      {/* DESCRIPTION CARD */}
                      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Description</h4>
                          <div className="prose prose-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{taskData.description || 'No description provided.'}</div>
                      </div>

                      {/* RESOURCES CARD */}
                      {( (taskData.images && taskData.images.length > 0) || (taskData.files && taskData.files.length > 0) || (taskData.links && taskData.links.length > 0) ) && (
                          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><PaperClipIcon /> Resources</h4>
                              {taskData.links?.length > 0 && (
                                  <div className="mb-4 flex flex-col gap-2">
                                      {taskData.links.map((link, i) => (<a key={i} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline text-sm bg-blue-50 p-2 rounded border border-blue-100"><LinkIcon /> {link}</a>))}
                                  </div>
                              )}
                              <div className="flex gap-3 flex-wrap">
                                  {taskData.images?.map((img, i) => (<div key={i} className="relative group"><img src={img} className="h-24 w-24 object-cover rounded-lg border shadow-sm cursor-zoom-in hover:scale-105 transition" onClick={() => setPreviewImage(img)} /></div>))}
                                  {taskData.files?.map((f, i) => (<a key={i} href={f.data} download={f.name} className="h-24 w-24 bg-slate-50 border rounded-lg flex flex-col items-center justify-center p-2 text-center hover:bg-slate-100 transition cursor-pointer"><FileIcon /><span className="text-[10px] font-bold text-slate-600 uppercase line-clamp-2 mt-1">{f.name}</span><span className="text-[8px] text-slate-400 mt-0.5">DOWNLOAD</span></a>))}
                              </div>
                          </div>
                      )}

                      {/* SUBMISSION CARD (QA) - VISIBLE IF SUBMISSION EXISTS */}
                      {taskData.submission && (
                          <div className="bg-purple-50 p-6 rounded-lg border border-purple-100 shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                  <span className="text-xs font-bold text-purple-700 uppercase">Submission by {resolveName(taskData.submission.submittedBy)}</span>
                                  <span className="text-[10px] text-purple-400">{new Date(taskData.submission.submittedAt).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-slate-700 mb-4 whitespace-pre-wrap">{taskData.submission.note}</p>
                              <div className="flex gap-2 overflow-x-auto pb-2">
                                  {taskData.submission.images?.map((img, i) => <img key={i} src={img} className="h-16 w-16 object-cover rounded border border-purple-200 cursor-zoom-in hover:opacity-80" onClick={() => setPreviewImage(img)} />)}
                                  {taskData.submission.files?.map((f, i) => (<a key={i} href={f.data} download={f.name} className="h-16 w-16 bg-white border border-purple-200 rounded flex flex-col items-center justify-center text-center p-1 hover:bg-purple-100 transition"><FileIcon /><span className="text-[8px] font-bold text-slate-600 line-clamp-2 w-full mt-1">{f.name}</span></a>))}
                              </div>
                              
                              {/* CREATOR QA ACTIONS - ONLY VISIBLE IF CREATOR & STATUS IS QA */}
                              {isCreator && isQA && (
                                  <div className="flex gap-3 mt-4 pt-4 border-t border-purple-200">
                                      <button onClick={() => setRevisionModal(true)} className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded font-bold text-xs hover:bg-red-50 hover:border-red-300 transition-all flex items-center gap-2 shadow-sm">Request Revision</button>
                                      <button onClick={() => { if(window.confirm("Approve?")) handleUpdateTaskStatus('Completed'); }} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold text-xs hover:bg-emerald-700 shadow-sm flex-1">Approve & Complete</button>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
             ) : <div className="text-center py-20 text-slate-400">Loading task...</div>}
          </div>

          {/* RIGHT: DISCUSSION SIDEBAR */}
          <div className="w-full lg:w-[320px] border-l border-slate-200 bg-white flex flex-col h-full z-20">
                <div className="p-4 bg-white border-b border-slate-100"><h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Discussion</h4></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                   {comments.map((msg) => (
                       <div key={msg.id} className="group">
                           <div className="flex justify-between items-baseline mb-1 px-1">
                               <span className="font-bold text-slate-700 text-xs">{resolveName(msg.userId)}</span>
                               <span className="text-[10px] text-slate-400">{msg.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           </div>
                           <div className="bg-white p-3 rounded-lg rounded-tl-none border border-slate-200 text-slate-600 text-sm shadow-sm break-words">
                               {msg.text}
                           </div>
                       </div>
                   ))}
                   <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendComment} className="p-3 border-t border-slate-200 bg-white flex gap-2">
                    <input className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Type a message..." value={newComment} onChange={e => setNewComment(e.target.value)} />
                    <button type="submit" disabled={!newComment.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition">Send</button>
                </form>
          </div>
        </div>
      </div>

      {/* --- IMAGE PREVIEW MODAL --- */}
      {previewImage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-[90vw] max-h-[90vh]">
                <img src={previewImage} className="max-w-full max-h-[90vh] rounded shadow-2xl" />
                <button onClick={() => setPreviewImage(null)} className="absolute -top-4 -right-4 bg-white text-black p-2 rounded-full shadow-lg hover:bg-gray-200">
                    <CloseIcon />
                </button>
            </div>
        </div>
      )}

      {/* --- SUBMISSION MODAL --- */}
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

      {/* --- REVISION REQUEST MODAL --- */}
      {revisionModal && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-red-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up border-t-4 border-red-500">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ExclamationIcon /> Request Revision</h3>
                    <button onClick={() => setRevisionModal(false)} className="text-slate-400 hover:text-slate-600"><CloseIcon /></button>
                </div>
                <p className="text-sm text-slate-500 mb-3">Please explain what changes are needed.</p>
                <textarea className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none h-32 resize-none" placeholder="Enter revision feedback here..." value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)} autoFocus></textarea>
                <div className="flex justify-end gap-3 pt-4 mt-2">
                    <button onClick={() => setRevisionModal(false)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:text-slate-700">Cancel</button>
                    <button onClick={handleConfirmRevision} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-lg shadow-red-500/20">Send Revision Request</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default HandoverPopup;