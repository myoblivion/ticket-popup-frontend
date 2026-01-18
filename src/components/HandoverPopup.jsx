import React, { useState, useEffect, useContext, useRef } from 'react';

import { db, auth } from '../firebaseConfig';

// --- NEW IMPORT ---
import { uploadFileToStorage } from '../utils/storageUtils';

import {
  doc, updateDoc, addDoc, deleteDoc, collection, serverTimestamp,
  query, orderBy, onSnapshot, where
} from 'firebase/firestore';

import { LanguageContext } from '../contexts/LanguageContext';


// --- CONFIGURATION ---
const TELEGRAM_BOT_TOKEN = '8204073221:AAEuEMTZoeRAPBx0IjkSc-ZafHjiTMarb6g';


// --- ICONS ---
const PaperClipIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>;
const LinkIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;
const ExclamationIcon = () => <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
const FileIcon = () => <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const CloseIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const SendIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
const EditIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h6M4 21l7-7 3 3 7-7" /></svg>;
const ClockIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const CalendarIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;

// --- MEMOIZED COMMENT ITEM (Prevents Lag) ---
const CommentItem = React.memo(({ msg, isMine, isCreator, onDelete, onPreview, resolveName, onEdit }) => {
  const displayName = msg.userName || (msg.userId ? resolveName(msg.userId) : 'Unknown');
  const initials = (displayName || 'Un').substring(0, 2).toUpperCase();
  const timeString = msg.createdAt?.toDate 
    ? msg.createdAt.toDate().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
    : 'Just now';

  return (
    <div className="flex gap-3 px-2 py-3 hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shadow-sm">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 text-sm">{displayName}</span>
            <span className="text-[10px] text-slate-400 font-medium">{timeString}</span>
          </div>
          <div className="flex items-center gap-2">
            {(isMine || isCreator) && (
              <button onClick={() => onDelete(msg.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1" title="Delete comment">
                <TrashIcon />
              </button>
            )}
            {isMine && !String(msg.id).startsWith('temp-') && (
              <button onClick={() => onEdit(msg)} className="text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all p-1" title="Edit comment">
                <EditIcon />
              </button>
            )}
          </div>
        </div>
        <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {msg.text}
        </div>
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {msg.attachments.map((att, idx) => (
              att.type === 'image' 
              ? <img key={idx} src={att.data} className="h-16 w-16 object-cover rounded-md border border-slate-200 cursor-zoom-in hover:opacity-90" onClick={() => onPreview(att.data)} alt="attachment" />
              : <a key={idx} href={att.data} download={att.name} className="h-16 w-16 flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-md p-1 text-center hover:bg-slate-100"><FileIcon /><span className="text-[8px] line-clamp-2 w-full mt-1 text-slate-500">{att.name}</span></a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// --- TELEGRAM HELPER ---
const sendTelegramNotification = async (chatId, type, details = {}, teamId) => {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  const { userName, projectName, taskName, duration, projectUrl, notes, fileCount } = details || {};
  const now = new Date().toLocaleString();

  const safeOrigin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://your-app-domain.com';
  const safeUrl = projectUrl || `${safeOrigin}/team/${teamId || ''}`;
  const linkHtml = `\n\n🔗 <a href="${safeUrl}">Open Task</a>\n${safeUrl}`;

  let message = '';
  switch (type) {
    case 'start':
    case 'resume': {
      const emojiStart = type === 'resume' ? '▶️' : '🚀';
      message = `<b>${emojiStart} User ${type === 'resume' ? 'Resumed' : 'Started'} Task</b>\n👤 <b>User:</b> ${userName || 'Unknown'}\n📂 <b>Project:</b> ${projectName || '—'}\n📝 <b>Task:</b> ${taskName || '—'}\n⏰ <b>Time:</b> ${now}${linkHtml}`;
      break;
    }
    case 'submit':
      message = `<b>✋ Task Submitted for QA</b>\n👤 <b>User:</b> ${userName || 'Unknown'}\n📂 <b>Project:</b> ${projectName || '—'}\n📝 <b>Task:</b> ${taskName || '—'}\n⏱️ <b>Duration:</b> ${duration || 'N/A'}\n📄 <b>Notes:</b> ${notes || 'No notes.'}\n📎 <b>Files/Images:</b> ${fileCount || 0}${linkHtml}`;
      break;
    case 'completed':
      message = `<b>✅ Task Approved & Completed</b>\n👤 <b>Approver:</b> ${userName || 'Unknown'}\n📂 <b>Project:</b> ${projectName || '—'}\n📝 <b>Task:</b> ${taskName || '—'}${linkHtml}`;
      break;
    case 'revision':
      message = `<b>↩️ Revision Requested</b>\n👤 <b>Reviewer:</b> ${userName || 'Unknown'}\n📂 <b>Project:</b> ${projectName || '—'}\n📝 <b>Task:</b> ${taskName || '—'}\n⚠️ <b>Feedback:</b> ${notes || 'No feedback provided.'}\n📎 <b>Attachments:</b> ${fileCount || 0}${linkHtml}`;
      break;
    case 'pause':
      message = `<b>⏸️ User Paused Task</b>\n👤 <b>User:</b> ${userName || 'Unknown'}\n📂 <b>Project:</b> ${projectName || '—'}\n📝 <b>Task:</b> ${taskName || '—'}\n⏱️ <b>Duration:</b> ${duration || 'N/A'}${linkHtml}`;
      break;
    case 'comment':
      message = `<b>💬 New Comment</b>\n👤 <b>Commenter:</b> ${userName || 'Unknown'}\n📂 <b>Project:</b> ${projectName || '—'}\n📝 <b>Task:</b> ${taskName || '—'}\n💬 <b>Comment:</b> ${notes ? (notes.length > 300 ? notes.slice(0, 300) + '…' : notes) : '—'}\n📎 <b>Attachments:</b> ${fileCount || 0}\n⏰ <b>Time:</b> ${now}${linkHtml}`;
      break;
    default:
      break;
  }

  if (message) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: true })
      });
      const data = await response.json();
      if (!data.ok && data.error_code === 400 && data.parameters?.migrate_to_chat_id) {
        if (teamId) {
          await updateDoc(doc(db, 'teams', teamId), { telegramChatId: data.parameters.migrate_to_chat_id });
          await sendTelegramNotification(data.parameters.migrate_to_chat_id, type, details, teamId);
        }
      }
    } catch (error) {
      console.error("Failed to send Telegram notification", error);
    }
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
    setElapsed(new Date() - start);
    const interval = setInterval(() => { setElapsed(new Date() - start); }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  return <span className={`font-mono text-xl font-bold tracking-tight ${isPaused ? 'text-amber-500' : 'text-emerald-600'}`}>{isPaused ? 'PAUSED: ' : ''}{formatDuration(elapsed)}</span>;
};

const HandoverPopup = ({ teamId, handoverId, taskId, onClose, membersDetails = [], currentUserUid }) => {
  const { t } = useContext(LanguageContext);
  const [projectData, setProjectData] = useState(null);
  const [taskData, setTaskData] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [telegramChatId, setTelegramChatId] = useState(null);
  const [uploading, setUploading] = useState(false); // --- NEW UPLOADING STATE ---
    
  // Comment State
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentAttachments, setCommentAttachments] = useState([]); 
    
  // Edit state
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [editingAttachments, setEditingAttachments] = useState([]);
  const editFileRef = useRef(null);

  const messagesEndRef = useRef(null);
  const [activeSession, setActiveSession] = useState(null);
  const [submissionModal, setSubmissionModal] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionImages, setSubmissionImages] = useState([]);
  const [submissionFiles, setSubmissionFiles] = useState([]);
  
  // Revision State
  const [revisionModal, setRevisionModal] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionImages, setRevisionImages] = useState([]); 
  const [revisionFiles, setRevisionFiles] = useState([]); 

  const [previewImage, setPreviewImage] = useState(null);
  const [commentAlert, setCommentAlert] = useState(null);
  const prevLastCommentId = useRef(null);
  const commentFileRef = useRef(null); 

  const [isCreator, setIsCreator] = useState(false);
  const normalizeId = (id) => (typeof id === 'string' ? id : (id && id.toString ? id.toString() : id));

  const resolveName = (uidOrId) => {
    if (!uidOrId) return 'Unknown';
    const uid = normalizeId(uidOrId);
    const member = membersDetails.find(m => m.uid === uid || m.id === uid || (m.userId && String(m.userId) === uid));
    if (member) return member.displayName || member.email || member.name || uid;
    if (auth?.currentUser && (auth.currentUser.uid === uid || String(auth.currentUser.uid) === uid)) {
      return auth.currentUser.displayName || auth.currentUser.email || uid;
    }
    return uid;
  };

  // --- DATA FETCHING & LISTENERS ---
  useEffect(() => {
    if (!teamId || !handoverId) return;
    setLoading(true);
    const docRef = doc(db, 'teams', teamId, 'handovers', handoverId);
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
    const teamRef = doc(db, 'teams', teamId);
    import('firebase/firestore').then(({ getDoc }) => {
      getDoc(teamRef).then(snap => { if (snap.exists()) setTelegramChatId(snap.data().telegramChatId); });
    });
    return () => unsubProject();
  }, [teamId, handoverId, taskId, currentUserUid]);

  // --- COMMENTS LISTENER ---
  useEffect(() => {
    if (!teamId || !handoverId || !taskId) return;
    const idAsString = String(taskId);
    const idAsNumber = Number(taskId);
    const possibleIds = [idAsString];
    if (!isNaN(idAsNumber)) { possibleIds.push(idAsNumber); }

    const commentsColPath = collection(db, 'teams', teamId, 'handovers', handoverId, 'comments');
    let unsub = () => {};

    const setupListener = () => {
      const qFallback = query(commentsColPath, orderBy('createdAt', 'asc'));
      unsub = onSnapshot(qFallback, (snapshot) => {
        const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filtered = all.filter(c => {
          if (possibleIds.includes(c.taskId)) return true;
          if (possibleIds.includes(String(c.taskId))) return true;
          if (!isNaN(Number(c.taskId)) && possibleIds.includes(Number(c.taskId))) return true;
          return false;
        });
        setComments(filtered);
        setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 100);
        if (filtered.length > 0) {
          const last = filtered[filtered.length - 1];
          if (prevLastCommentId.current && prevLastCommentId.current !== last.id && last.userId !== currentUserUid) {
            const displayName = last.userName || resolveName(last.userId);
            const snippet = last.text ? last.text.slice(0, 120) : '';
            setCommentAlert({ text: `${displayName} commented: ${snippet}`, commentId: last.id });
            setTimeout(() => setCommentAlert(null), 6000);
          }
          prevLastCommentId.current = last.id;
        }
      });
    };
    setupListener();
    return () => { try { if (typeof unsub === 'function') unsub(); } catch (e) { /* ignore */ } prevLastCommentId.current = null; };
  }, [teamId, handoverId, taskId, currentUserUid]);

  useEffect(() => {
    if (!currentUserUid || !teamId || !handoverId) return;
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

  // --- ACTIONS ---
  const generateTaskUrl = () => {
    const identifier = taskData?.taskNumber || taskData?.id || taskId || '';
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://your-app-domain.com';
    return !identifier ? `${origin}/team/${teamId}` : `${origin}/team/${teamId}?taskId=${encodeURIComponent(identifier)}`;
  };

  const handleUpdateTaskStatus = async (newStatus, additionalData = {}) => {
    try {
      const docRef = doc(db, 'teams', teamId, 'handovers', handoverId);
      const latestSnap = await import('firebase/firestore').then(({ getDoc }) => getDoc(docRef));
      if (!latestSnap.exists()) return;
      let tasks = latestSnap.data().projectTasks || [];
      const taskIndex = tasks.findIndex(t => t.id === taskId || String(t.taskNumber) === String(taskId));
      if (taskIndex === -1) return;
      tasks[taskIndex].status = newStatus;
      if (Object.keys(additionalData).length > 0) tasks[taskIndex] = { ...tasks[taskIndex], ...additionalData };
      await updateDoc(docRef, { projectTasks: tasks });
    } catch (err) { console.error("Error updating status:", err); }
  };

  const handleToggleWork = async (actionType) => {
    if (!currentUserUid || !taskData) return;
    const userName = auth.currentUser?.displayName || resolveName(currentUserUid) || 'Unknown';
    const projectUrl = generateTaskUrl();
    try {
      if (actionType === 'start' || actionType === 'resume') handleUpdateTaskStatus('In Progress');
      if (activeSession) {
        const logRef = doc(db, 'teams', teamId, 'workLogs', activeSession.id);
        const endTime = new Date();
        const startTime = activeSession.startTime?.toDate ? activeSession.startTime.toDate() : new Date(activeSession.startTime);
        const durationStr = formatDuration(endTime - startTime);
        await updateDoc(logRef, { endTime: serverTimestamp(), status: 'completed', action: actionType === 'pause' ? 'Paused' : 'Stopped' });
        if (actionType === 'pause') sendTelegramNotification(telegramChatId, 'pause', { userName, projectName: projectData?.title, taskName: taskData?.title, duration: durationStr, projectUrl }, teamId);
      }
      if (actionType === 'start' || actionType === 'resume') {
        const logTaskId = taskData.id || taskId;
        await addDoc(collection(db, 'teams', teamId, 'workLogs'), {
          type: 'task', action: 'Working', userName, userId: currentUserUid, handoverId, taskId: logTaskId, taskTitle: taskData.title, startTime: serverTimestamp(), status: 'active', createdAt: serverTimestamp()
        });
        sendTelegramNotification(telegramChatId, actionType, { userName, projectName: projectData?.title, taskName: taskData?.title, projectUrl }, teamId);
      }
    } catch (err) { console.error("Error toggling work:", err); }
  };

  const handleConfirmSubmit = async () => {
    const userName = auth.currentUser?.displayName || resolveName(currentUserUid) || 'Unknown';
    const projectUrl = generateTaskUrl();
    const details = { userName, projectName: projectData?.title, taskName: taskData?.title, notes: submissionNote, fileCount: submissionImages.length + submissionFiles.length, projectUrl };
    if (activeSession) {
      const logRef = doc(db, 'teams', teamId, 'workLogs', activeSession.id);
      const endTime = new Date();
      const startTime = activeSession.startTime?.toDate ? activeSession.startTime.toDate() : new Date(activeSession.startTime);
      const durationStr = formatDuration(endTime - startTime);
      await updateDoc(logRef, { endTime: serverTimestamp(), status: 'completed', action: 'Submitted' });
      sendTelegramNotification(telegramChatId, 'submit', { ...details, duration: durationStr }, teamId);
    } else {
      sendTelegramNotification(telegramChatId, 'submit', { ...details, duration: 'N/A' }, teamId);
    }
    await handleUpdateTaskStatus('QA', {
      submission: { note: submissionNote, images: submissionImages, files: submissionFiles, submittedBy: currentUserUid, submittedAt: new Date().toISOString() }
    });
    setSubmissionModal(false);
  };

  const handleConfirmRevision = async () => {
    if (!revisionReason.trim() && revisionImages.length === 0 && revisionFiles.length === 0) return alert("Please provide a reason or attachment.");
    const userName = auth.currentUser?.displayName || resolveName(currentUserUid) || 'Unknown';
    const projectUrl = generateTaskUrl();
    await handleUpdateTaskStatus('Revision', { 
        revisionFeedback: { reason: revisionReason, images: revisionImages, files: revisionFiles, requestedBy: currentUserUid, requestedAt: new Date().toISOString() } 
    });
    sendTelegramNotification(telegramChatId, 'revision', { 
        userName, projectName: projectData?.title, taskName: taskData?.title, notes: revisionReason, fileCount: revisionImages.length + revisionFiles.length, projectUrl 
    }, teamId);
    setRevisionModal(false); 
    setRevisionReason('');
    setRevisionImages([]);
    setRevisionFiles([]);
  };

  // --- COMMENT ACTIONS ---
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try { await deleteDoc(doc(db, 'teams', teamId, 'handovers', handoverId, 'comments', commentId)); } catch (err) { console.error("Failed", err); }
  };
  const startEditComment = (msg) => {
    if (!msg || !msg.id || String(msg.id).startsWith('temp-')) return;
    setEditingCommentId(msg.id);
    setEditingText(msg.text || '');
    setEditingAttachments(msg.attachments ? JSON.parse(JSON.stringify(msg.attachments)) : []);
  };
  const cancelEdit = () => { setEditingCommentId(null); setEditingText(''); setEditingAttachments([]); };
  const handleEditFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const type = file.type.startsWith('image/') ? 'image' : 'file';
        setEditingAttachments(prev => [...prev, { type, data: evt.target.result, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
  };
  const removeEditAttachment = (index) => setEditingAttachments(prev => prev.filter((_, i) => i !== index));
  const handleSaveEdit = async () => {
    if (!editingCommentId) return;
    try {
      const commentRef = doc(db, 'teams', teamId, 'handovers', handoverId, 'comments', editingCommentId);
      await updateDoc(commentRef, { text: editingText, attachments: editingAttachments, editedAt: serverTimestamp(), editedBy: currentUserUid });
      setComments(prev => prev.map(c => c.id === editingCommentId ? { ...c, text: editingText, attachments: editingAttachments, editedAt: { toDate: () => new Date() }, editedBy: currentUserUid } : c));
      cancelEdit();
    } catch (err) { console.error(err); alert('Failed to save edit.'); }
  };

  // --- GENERAL HANDLERS ---
  const processPaste = (e, setImagesFunc) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        const reader = new FileReader();
        reader.onload = (evt) => setImagesFunc(prev => [...prev, evt.target.result]);
        reader.readAsDataURL(blob);
      }
    }
  };

  // --- UPDATED FILE UPLOAD HANDLER (Async / Storage) ---
  const handleFileUpload = async (e, setFilesFunc) => {
    const files = Array.from(e.target.files);
    setUploading(true); // Show a spinner while uploading

    try {
        // Upload all files in parallel
        // Uses the helper from storageUtils to upload to Firebase Storage and get a download URL
        const uploadPromises = files.map(file => 
            uploadFileToStorage(file, `teams/${teamId}/tasks/${taskId}`)
        );
        
        const uploadedFiles = await Promise.all(uploadPromises);
        
        // Add to state (generic setter, works for Submission or Revision)
        setFilesFunc(prev => [...prev, ...uploadedFiles]);
    } catch (error) {
        console.error("Upload failed", error);
        alert("Error uploading files");
    } finally {
        setUploading(false);
    }
  };

  const handleCommentPaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        const reader = new FileReader();
        reader.onload = (evt) => { setCommentAttachments(prev => [...prev, { type: 'image', data: evt.target.result, name: 'Pasted Image' }]); };
        reader.readAsDataURL(blob);
      }
    }
  };
  const handleCommentFileSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const type = file.type.startsWith('image/') ? 'image' : 'file';
        setCommentAttachments(prev => [...prev, { type, data: evt.target.result, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
  };
  const removeCommentAttachment = (index) => setCommentAttachments(prev => prev.filter((_, i) => i !== index));

  const getStatusColor = (status) => {
    switch (status) {
      case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'QA': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Revision': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (!teamId || !handoverId || !taskId) return null;

  const isAssigned = taskData && ((Array.isArray(taskData.assignedTo) && taskData.assignedTo.includes(currentUserUid)) || isCreator);
  const isActive = activeSession && activeSession.taskId === (taskData?.id || taskId) && activeSession.status === 'active';
  const isPaused = activeSession && activeSession.taskId === (taskData?.id || taskId) && activeSession.status === 'paused';
  const isRevision = taskData?.status === 'Revision';
  const isQA = taskData?.status === 'QA';
  const isCompleted = taskData?.status === 'Completed';
  const showWorkerActions = isAssigned && !isCompleted && !isQA;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] h-[95vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* --- HEADER --- */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
               <span className="truncate max-w-[200px]">{projectData?.title || 'Project'}</span>
               <span>/</span>
               <span>Task Details</span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 leading-none truncate max-w-2xl" title={taskData?.title}>
               {loading ? 'Loading...' : (taskData?.title || 'Task Details')}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <CloseIcon />
          </button>
        </div>

        {/* --- MAIN BODY --- */}
        <div className="flex-1 flex overflow-hidden bg-slate-50/50">
          
          {/* LEFT: CONTENT SCROLLABLE */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            
            {/* WORKER TOOLBAR (Fixed Top) */}
            <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
                {/* Status Badges */}
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase border tracking-wider ${getStatusColor(taskData?.status)}`}>{taskData?.status}</span>
                    <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase border ${taskData?.priority === 'High' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{taskData?.priority || 'Normal'} Priority</span>
                </div>

                {/* Timer & Actions */}
                <div className="flex items-center gap-4">
                    {(isActive || isPaused) && <LiveDuration startTime={activeSession?.startTime} isPaused={isPaused} />}
                    
                    {showWorkerActions && (
                       <div className="flex items-center gap-2">
                          {(!isActive && !isPaused) && (
                            <button onClick={() => handleToggleWork('start')} className={`px-6 py-2 rounded-lg font-bold text-sm text-white shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all ${isRevision ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                              {isRevision ? 'Start Revision' : 'Start Timer'}
                            </button>
                          )}
                          {isPaused && <button onClick={() => handleToggleWork('resume')} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all">Resume</button>}
                          {isActive && (
                            <>
                              <button onClick={() => handleToggleWork('pause')} className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-bold text-sm hover:bg-amber-200 transition-colors">Pause</button>
                              <button onClick={() => setSubmissionModal(true)} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm hover:bg-slate-900 shadow-lg hover:scale-105 active:scale-95 transition-all">Submit Work</button>
                            </>
                          )}
                       </div>
                    )}
                    {isQA && <span className="text-sm font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">Waiting for Review</span>}
                    {isCompleted && <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Task Completed</span>}
                </div>
            </div>

            {/* SCROLLABLE CONTENT AREA */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6">
                    
                    {/* META INFO GRID */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Task ID</p>
                            <p className="text-sm font-mono font-semibold text-slate-700">#{taskData?.taskNumber || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estimate</p>
                            <div className="flex items-center gap-1.5 text-slate-700">
                                <ClockIcon /> <span className="text-sm font-semibold">{taskData?.estimate || 'None'}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Due Date</p>
                            <div className="flex items-center gap-1.5 text-slate-700">
                                <CalendarIcon /> <span className="text-sm font-semibold">{taskData?.dueDate ? new Date(taskData.dueDate).toLocaleDateString() : 'No date'}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assignee</p>
                            <div className="flex -space-x-2">
                                {(taskData?.assignedTo || []).map((uid, i) => (
                                    <div key={i} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[9px] font-bold text-slate-600" title={resolveName(uid)}>
                                        {resolveName(uid).charAt(0).toUpperCase()}
                                    </div>
                                ))}
                                {(!taskData?.assignedTo || taskData.assignedTo.length === 0) && <span className="text-xs text-slate-400 italic">Unassigned</span>}
                            </div>
                        </div>
                    </div>

                    {/* REVISION FEEDBACK ALERT */}
                    {(taskData?.status === 'Revision' || taskData?.revisionFeedback) && (
                        <div className="bg-red-50 border-l-4 border-red-500 rounded-r-xl p-5 shadow-sm">
                            <h4 className="text-red-700 font-bold flex items-center gap-2 mb-2"><ExclamationIcon /> Revision Requested</h4>
                            <div className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed bg-white/60 p-3 rounded-lg border border-red-100">
                                {taskData.revisionFeedback?.reason || 'No specific notes provided.'}
                            </div>
                            {(taskData.revisionFeedback?.images?.length > 0 || taskData.revisionFeedback?.files?.length > 0) && (
                                <div className="mt-3">
                                    <p className="text-xs font-bold text-red-400 uppercase mb-2">Attached Feedback</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {taskData.revisionFeedback.images?.map((img, i) => <img key={i} src={img} className="h-16 w-16 object-cover rounded-lg border border-red-200 cursor-zoom-in" onClick={() => setPreviewImage(img)} />)}
                                        {taskData.revisionFeedback.files?.map((f, i) => <a key={i} href={f.data} download={f.name} className="h-16 w-16 bg-white border border-red-200 rounded-lg flex flex-col items-center justify-center p-1 hover:bg-red-50"><FileIcon /><span className="text-[8px] text-center w-full truncate mt-1">{f.name}</span></a>)}
                                    </div>
                                </div>
                            )}
                            <p className="mt-2 text-xs text-red-400 font-medium">By {resolveName(taskData.revisionFeedback?.requestedBy)} • {new Date(taskData.revisionFeedback?.requestedAt).toLocaleString()}</p>
                        </div>
                    )}

                    {/* DESCRIPTION */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</h4>
                        </div>
                        <div className="p-6 text-slate-700 text-sm leading-7 whitespace-pre-wrap">
                            {taskData?.description || <span className="text-slate-400 italic">No description provided for this task.</span>}
                        </div>
                    </div>

                    {/* RESOURCES & ATTACHMENTS */}
                    {(((taskData?.images?.length > 0) || (taskData?.files?.length > 0) || (taskData?.links?.length > 0))) && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                                <PaperClipIcon />
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resources</h4>
                            </div>
                            <div className="p-6">
                                {taskData.links?.length > 0 && (
                                    <div className="mb-6 space-y-2">
                                        {taskData.links.map((link, i) => (
                                            <a key={i} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-100 group transition-all">
                                                <div className="p-2 bg-white rounded-full border border-slate-200 text-slate-400 group-hover:text-blue-500"><LinkIcon /></div>
                                                <span className="text-sm font-medium text-slate-600 group-hover:text-blue-700 truncate underline decoration-transparent group-hover:decoration-current">{link}</span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                    {taskData.images?.map((img, i) => (
                                        <div key={i} className="aspect-square rounded-lg border border-slate-200 overflow-hidden relative group cursor-pointer shadow-sm hover:shadow-md transition-all" onClick={() => setPreviewImage(img)}>
                                            <img src={img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                        </div>
                                    ))}
                                    {taskData.files?.map((f, i) => (
                                        <a key={i} href={f.data} download={f.name} className="aspect-square rounded-lg border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-3 text-center hover:bg-slate-100 hover:border-blue-200 transition-all group">
                                            <FileIcon />
                                            <span className="mt-2 text-[10px] font-semibold text-slate-600 line-clamp-2 leading-tight group-hover:text-blue-600">{f.name}</span>
                                            <span className="mt-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider group-hover:text-blue-400">Download</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SUBMISSION & REVIEW SECTION */}
                    {taskData?.submission && (
                        <div className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden ring-1 ring-purple-50">
                            <div className="px-6 py-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
                                <h4 className="text-sm font-bold text-purple-800">Latest Submission</h4>
                                <span className="text-xs font-medium text-purple-600">{new Date(taskData.submission.submittedAt).toLocaleString()}</span>
                            </div>
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                     <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs">{resolveName(taskData.submission.submittedBy).charAt(0)}</div>
                                     <div>
                                         <p className="text-sm font-bold text-slate-800">{resolveName(taskData.submission.submittedBy)}</p>
                                         <p className="text-xs text-slate-500">submitted this task for review</p>
                                     </div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-700 text-sm whitespace-pre-wrap mb-4">
                                    {taskData.submission.note}
                                </div>
                                
                                {(taskData.submission.images?.length > 0 || taskData.submission.files?.length > 0) && (
                                    <div className="flex gap-3 overflow-x-auto pb-2">
                                        {taskData.submission.images?.map((img, i) => <img key={i} src={img} className="h-20 w-20 object-cover rounded-lg border border-slate-200 cursor-zoom-in hover:opacity-90 shadow-sm" onClick={() => setPreviewImage(img)} />)}
                                        {taskData.submission.files?.map((f, i) => <a key={i} href={f.data} download={f.name} className="h-20 w-20 bg-white border border-slate-200 rounded-lg flex flex-col items-center justify-center p-2 hover:bg-slate-50 shadow-sm"><FileIcon /><span className="text-[9px] text-center w-full truncate mt-1">{f.name}</span></a>)}
                                    </div>
                                )}

                                {isCreator && isQA && (
                                    <div className="mt-6 pt-6 border-t border-slate-100 flex gap-3">
                                        <button onClick={() => setRevisionModal(true)} className="flex-1 py-2.5 rounded-lg border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 hover:border-red-300 transition-all">Request Changes</button>
                                        <button onClick={() => { if (window.confirm("Approve?")) handleUpdateTaskStatus('Completed'); }} className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 shadow-md transition-all">Approve & Complete</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>

          {/* RIGHT: COMMENTS SIDEBAR (Kept logic, refreshed container style) */}
          <div className="w-full lg:w-[350px] border-l border-slate-200 bg-white flex flex-col h-full shrink-0 z-20 shadow-[-5px_0_20px_-5px_rgba(0,0,0,0.05)]">
            <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 h-[57px]">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Activity Log</h4>
              <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{comments.length}</span>
            </div>

            {commentAlert && (
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 text-xs font-medium text-amber-800 cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => { if (typeof window !== 'undefined') window.open(generateTaskUrl(), '_blank'); }}>
                 🔔 {commentAlert.text}
              </div>
            )}

            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
              {comments.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-xs italic"><span className="text-xl mb-2">💬</span>No comments yet.</div>}
              {comments.map((msg) => (
                editingCommentId === msg.id ? (
                  <div key={`edit-${msg.id}`} className="p-3 border-b border-slate-100 bg-slate-50">
                    <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 mb-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white" rows={3} autoFocus />
                    <div className="flex gap-2 items-center justify-between">
                       <div className="flex items-center gap-2">
                          <button type="button" onClick={() => editFileRef.current.click()} className="p-1.5 bg-white border rounded text-slate-500 hover:text-blue-600"><PaperClipIcon /></button>
                          <input type="file" multiple className="hidden" ref={editFileRef} onChange={handleEditFileSelect} />
                          <span className="text-[10px] text-slate-400">{editingAttachments.length} attached</span>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={cancelEdit} className="px-3 py-1 rounded text-xs font-semibold text-slate-500 hover:bg-slate-200">Cancel</button>
                          <button onClick={handleSaveEdit} className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">Save</button>
                       </div>
                    </div>
                  </div>
                ) : (
                  <CommentItem key={msg.id} msg={msg} isMine={msg.userId === (auth.currentUser?.uid || currentUserUid)} isCreator={isCreator} onDelete={handleDeleteComment} onPreview={setPreviewImage} resolveName={resolveName} onEdit={startEditComment} />
                )
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* ATTACHMENT PREVIEW BAR */}
            {commentAttachments.length > 0 && (
                <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex gap-2 overflow-x-auto">
                    {commentAttachments.map((att, i) => (
                        <div key={i} className="relative group shrink-0">
                            {att.type === 'image' ? <img src={att.data} className="h-10 w-10 object-cover rounded border border-slate-300" /> : <div className="h-10 w-10 bg-white border rounded flex items-center justify-center"><FileIcon /></div>}
                            <button onClick={() => removeCommentAttachment(i)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] shadow-sm z-10 hover:bg-red-600">×</button>
                        </div>
                    ))}
                </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newComment.trim() && commentAttachments.length === 0) return;
              const userIdToUse = auth.currentUser?.uid || currentUserUid || 'unknown-user';
              const userName = auth.currentUser?.displayName || resolveName(userIdToUse);
              const commentPayload = { text: newComment, userId: userIdToUse, userName, taskId: String(taskId), attachments: commentAttachments, createdAt: serverTimestamp() };
              const tempId = 'temp-' + Date.now();
              setComments(prev => [...prev, { id: tempId, ...commentPayload, createdAt: { toDate: () => new Date() } }]);
              setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 10);
              setNewComment(''); setCommentAttachments([]);
              try {
                await addDoc(collection(db, 'teams', teamId, 'handovers', handoverId, 'comments'), commentPayload);
                setComments(prev => prev.filter(c => c.id !== tempId));
                sendTelegramNotification(telegramChatId, 'comment', { userName, projectName: projectData?.title, taskName: taskData?.title, notes: newComment, fileCount: commentAttachments.length, projectUrl: generateTaskUrl() }, teamId);
              } catch (err) { setComments(prev => prev.filter(c => c.id !== tempId)); console.error(err); alert('Failed.'); }
            }} className="p-3 border-t border-slate-200 bg-white">
               <div className="flex gap-2 items-end bg-slate-50 border border-slate-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all">
                  <button type="button" onClick={() => commentFileRef.current.click()} className="text-slate-400 hover:text-blue-600 p-2 hover:bg-white rounded-lg transition-colors"><PaperClipIcon /></button>
                  <input type="file" multiple className="hidden" ref={commentFileRef} onChange={handleCommentFileSelect} />
                  <textarea className="flex-1 bg-transparent border-none p-2 text-sm focus:ring-0 resize-none max-h-32" placeholder="Type a message..." rows="1" value={newComment} onChange={e => { setNewComment(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} onPaste={handleCommentPaste} />
                  <button type="submit" disabled={!newComment.trim() && commentAttachments.length === 0} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-300 transition-all"><SendIcon /></button>
               </div>
            </form>
          </div>
        </div>

        {/* --- MODALS (IMAGE PREVIEW, SUBMIT, REVISION) --- */}
        {previewImage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-4" onClick={() => setPreviewImage(null)}>
             <img src={previewImage} className="max-w-full max-h-full rounded shadow-none" onClick={(e) => e.stopPropagation()} />
             <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 bg-white/10 text-white p-2 rounded-full hover:bg-white/20"><CloseIcon /></button>
          </div>
        )}

        {/* SUBMISSION MODAL */}
        {submissionModal && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 flex flex-col max-h-[90vh]">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Submit Work</h3>
              <div className="flex-1 overflow-y-auto space-y-4">
                <textarea className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-32" placeholder="Submission notes..." value={submissionNote} onChange={(e) => setSubmissionNote(e.target.value)} onPaste={(e) => processPaste(e, setSubmissionImages)}></textarea>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Attachments</label>
                  <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <span className="text-xs font-medium text-slate-500">
                        {uploading ? "Uploading..." : "Click to upload files"}
                    </span>
                    <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, setSubmissionFiles)} disabled={uploading} />
                  </label>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {submissionImages.map((img, i) => <img key={i} src={img} className="h-10 w-10 object-cover rounded border" />)}
                    {submissionFiles.map((f, i) => <div key={i} className="px-2 py-1 bg-slate-100 rounded text-xs font-medium border text-slate-600">{f.name}</div>)}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-slate-100">
                <button onClick={() => setSubmissionModal(false)} className="px-4 py-2 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-lg">Cancel</button>
                <button onClick={handleConfirmSubmit} disabled={uploading} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 shadow-lg disabled:opacity-50">
                    {uploading ? "Uploading..." : "Confirm Submit"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REVISION MODAL */}
        {revisionModal && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-red-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 border-t-4 border-red-500 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ExclamationIcon /> Request Revision</h3>
                <button onClick={() => setRevisionModal(false)} className="text-slate-400 hover:text-slate-600"><CloseIcon /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                  <p className="text-sm text-slate-600">Describe required changes. Paste screenshots directly.</p>
                  <textarea className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none h-32 resize-none" placeholder="Describe changes..." value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)} onPaste={(e) => processPaste(e, setRevisionImages)} autoFocus></textarea>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Attachments</label>
                      <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                          <span className="text-xs text-slate-500">
                              {uploading ? "Uploading..." : "Upload Screenshots or Files"}
                          </span>
                          <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, setRevisionFiles)} disabled={uploading} />
                      </label>
                      {(revisionImages.length > 0 || revisionFiles.length > 0) && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                              {revisionImages.map((img, i) => (
                                  <div key={`rev-img-${i}`} className="relative group">
                                      <img src={img} className="h-10 w-10 object-cover rounded border" />
                                      <button onClick={() => setRevisionImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">×</button>
                                  </div>
                              ))}
                              {revisionFiles.map((f, i) => (
                                  <div key={`rev-file-${i}`} className="relative group px-2 py-1 bg-slate-100 rounded text-xs border flex items-center">
                                      {f.name}
                                      <button onClick={() => setRevisionFiles(prev => prev.filter((_, idx) => idx !== i))} className="ml-2 text-red-500 font-bold hover:text-red-700">×</button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                <button onClick={() => setRevisionModal(false)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-lg">Cancel</button>
                <button onClick={handleConfirmRevision} disabled={uploading} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-lg disabled:opacity-50">
                    {uploading ? "Uploading..." : "Send Request"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default HandoverPopup;