// firebase-script.js (ES module for Firebase v12 modular SDK)
import {
  getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

(function(){
  if(!window.__FIREBASE_APP__) throw new Error('Firebase app not initialized in index.html');
  const app = window.__FIREBASE_APP__;
  const db = getFirestore(app);
  const storage = getStorage(app);

  // UI helpers
  const el = s => document.querySelector(s);
  const els = s => Array.from(document.querySelectorAll(s));
  const uuid = p => p + '-' + Math.random().toString(36).slice(2,9);
  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file

  /* ---------- Employee helpers ---------- */
  async function fetchEmployeesOnce(){
    const q = query(collection(db, 'employees'), orderBy('name'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function addEmployee(name){
    name = (name||'').trim();
    if(!name) return null;
    // duplicate check: simple by nameLower
    const q = query(collection(db, 'employees'), where('nameLower','==', name.toLowerCase()));
    const res = await getDocs(q);
    if(!res.empty) return null;
    const ref = doc(collection(db, 'employees'));
    await setDoc(ref, { name, nameLower: name.toLowerCase(), createdAt: serverTimestamp() });
    return { id: ref.id, name };
  }

  function listenEmployees(cb){
    const q = query(collection(db, 'employees'), orderBy('name'));
    return onSnapshot(q, snap => {
      const arr = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      cb(arr);
    });
  }

  /* ---------- Tasks & attachments ---------- */
  async function createTask(task){
    // task: { title, details, assignedId, assignedName, deadline, status }
    const ref = doc(collection(db, 'tasks'));
    await setDoc(ref, {
      title: task.title,
      details: task.details || '',
      assignedId: task.assignedId || null,
      assignedName: task.assignedName || '',
      createdAt: serverTimestamp(),
      deadline: task.deadline || null,
      status: task.status || 'Open'
    });
    return ref.id;
  }

  async function updateTask(taskId, updates){
    const ref = doc(db, 'tasks', taskId);
    await updateDoc(ref, updates);
  }

  async function deleteTask(taskId){
    // delete attachments in subcollection AND storage objects
    const attColRef = collection(db, 'tasks', taskId, 'attachments');
    const attSnap = await getDocs(attColRef);
    const promises = [];
    attSnap.forEach(a => {
      const data = a.data();
      if(data.storagePath){
        const sref = storageRef(storage, data.storagePath);
        promises.push(deleteObject(sref).catch(()=>{}));
      }
      promises.push(deleteDoc(doc(db, 'tasks', taskId, 'attachments', a.id)));
    });
    await Promise.all(promises);
    await deleteDoc(doc(db, 'tasks', taskId));
  }

  function listenTasks(cb){
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, async snap => {
      // build tasks with attachments
      const tasks = await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        // attachments
        const attsSnap = await getDocs(collection(db, 'tasks', d.id, 'attachments'));
        const attachments = attsSnap.docs.map(a=>({ id:a.id, ...a.data() }));
        return { id: d.id, ...data, attachments };
      }));
      cb(tasks);
    });
  }

  // upload files to Storage under tasks/{taskId}/...
  async function uploadFiles(taskId, files){
    const uploaded = [];
    for(const file of files){
      if(file.size > MAX_BYTES) throw new Error('File too large: ' + file.name);
      const path = `tasks/${taskId}/${Date.now()}-${file.name.replace(/\s+/g,'_')}`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      const attRef = doc(collection(db, 'tasks', taskId, 'attachments'));
      await setDoc(attRef, {
        name: file.name,
        mime: file.type,
        url,
        storagePath: path,
        external: false,
        createdAt: serverTimestamp()
      });
      uploaded.push({ id: attRef.id, name: file.name, url, storagePath: path });
    }
    return uploaded;
  }

  async function addExternalLink(taskId, url, label){
    const attRef = doc(collection(db, 'tasks', taskId, 'attachments'));
    await setDoc(attRef, {
      name: label || url,
      mime: 'link',
      url,
      external: true,
      createdAt: serverTimestamp()
    });
    return { id: attRef.id, name: label||url, url };
  }

  /* ---------- UI rendering ---------- */
  function escapeHtml(s){ if(!s) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
  function badgeClass(status){
    if(status === 'Open') return 'badge open';
    if(status === 'In-progress') return 'badge inprogress';
    if(status === 'Waiting client') return 'badge waiting';
    if(status === 'Closed') return 'badge closed';
    return 'badge';
  }

  function renderTasks(tasks){
    const tasksBody = el('#tasksBody');
    const queryText = (el('#searchInput') && el('#searchInput').value.trim().toLowerCase()) || '';
    const statusFilter = (el('#statusFilter') && el('#statusFilter').value) || '';
    const dateFilter = (el('#dateFilter') && el('#dateFilter').value) || '';
    const assignedFilter = (el('#assignedFilter') && el('#assignedFilter').value) || '';

    const filtered = tasks.filter(t => {
      if(statusFilter && t.status !== statusFilter) return false;
      if(assignedFilter && t.assignedId !== assignedFilter) return false;
      if(dateFilter && t.createdAt && t.createdAt.toDate) {
        const createdIso = t.createdAt.toDate().toISOString().slice(0,10);
        if(createdIso !== dateFilter) return false;
      }
      if(queryText){
        const hay = (t.title + ' ' + (t.details||'') + ' ' + (t.assignedName||'')).toLowerCase();
        if(!hay.includes(queryText)) return false;
      }
      return true;
    });

    el('#countLabel').textContent = filtered.length + ' tasks';

    tasksBody.innerHTML = filtered.map(t => {
      const created = t.createdAt && t.createdAt.toDate ? t.createdAt.toDate().toLocaleDateString() : '-';
      const deadline = t.deadline || '-';
      const attsHtml = (t.attachments && t.attachments.length) ? t.attachments.slice(0,2).map(a=>{
        return `<a class="attach-link" href="${a.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.name)}</a>`;
      }).join(', ') + (t.attachments.length>2 ? ` +${t.attachments.length-2}` : '') : '<span class="muted">—</span>';
      return `
        <tr data-id="${t.id}">
          <td><div class="title">${escapeHtml(t.title)}</div><div class="muted" style="margin-top:6px">${t.details ? escapeHtml(t.details) : ''}</div></td>
          <td>${escapeHtml(t.assignedName||'')}</td>
          <td class="muted">${created}</td>
          <td class="muted">${deadline}</td>
          <td><span class="${badgeClass(t.status||'Open')}">${escapeHtml(t.status||'Open')}</span></td>
          <td>${attsHtml}</td>
          <td style="text-align:right" class="actions">
            <button data-action="edit">Edit</button>
            <button data-action="delete">Delete</button>
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="7" class="muted">No tasks found.</td></tr>`;

    // attach action handlers
    els('.actions button').forEach(btn => {
      btn.onclick = async (ev) => {
        const tr = ev.target.closest('tr');
        if(!tr) return;
        const id = tr.dataset.id;
        const action = ev.target.dataset.action;
        if(action === 'edit') openEditModal(id);
        if(action === 'delete') {
          if(confirm('Delete this task?')) {
            await deleteTask(id);
          }
        }
      };
    });
  }

  /* ---------- Modal & form handling ---------- */
  let editingId = null;
  let modalAttachments = []; // { id, file?, url?, name, external?, storagePath? }

  function resetModalAttachments(){ modalAttachments = []; renderModalAttachments(); }
  function renderModalAttachments(){
    const list = el('#attachmentsList');
    if(!list) return;
    list.innerHTML = modalAttachments.map(a => `
      <div class="attach-pill" data-aid="${a.id}">
        ${a.external ? '🔗' : (a.name ? '📎' : '📁')} 
        <span style="margin-left:6px">${escapeHtml(a.name)}</span>
        <button class="attach-remove" data-remove="${a.id}" style="margin-left:8px">✕</button>
      </div>
    `).join('') || `<div class="muted">No attachments added.</div>`;

    els('.attach-remove').forEach(b => b.onclick = (e) => {
      const id = b.dataset.remove;
      modalAttachments = modalAttachments.filter(x=>x.id !== id);
      renderModalAttachments();
    });
  }

  function showModal(){ const b = el('#modalBack'); if(b) b.style.display = 'flex'; }
  function closeModal(){ const b = el('#modalBack'); if(b) b.style.display = 'none'; editingId = null; resetModalAttachments(); }

  async function openAddModal(){
    editingId = null;
    if(el('#modalTitle')) el('#modalTitle').textContent = 'Add Task';
    if(el('#taskTitle')) el('#taskTitle').value = '';
    if(el('#taskDetails')) el('#taskDetails').value = '';
    if(el('#statusSelect')) el('#statusSelect').value = 'Open';
    if(el('#deadline')) el('#deadline').value = '';
    const emps = await fetchEmployeesOnce();
    if(el('#assignTo') && emps.length) el('#assignTo').value = emps[0].id;
    resetModalAttachments();
    showModal();
  }

  async function openEditModal(taskId){
    editingId = taskId;
    const docRef = doc(db, 'tasks', taskId);
    const snap = await getDoc(docRef);
    if(!snap.exists()) return alert('Task not found');
    const data = snap.data();
    if(el('#modalTitle')) el('#modalTitle').textContent = 'Edit Task';
    if(el('#taskTitle')) el('#taskTitle').value = data.title || '';
    if(el('#taskDetails')) el('#taskDetails').value = data.details || '';
    if(el('#statusSelect')) el('#statusSelect').value = data.status || 'Open';
    if(el('#deadline')) el('#deadline').value = data.deadline || '';
    if(el('#assignTo')) el('#assignTo').value = data.assignedId || '';
    // load attachments into modalAttachments
    const attsSnap = await getDocs(collection(db, 'tasks', taskId, 'attachments'));
    modalAttachments = attsSnap.docs.map(a => ({ id:a.id, ...a.data() }));
    renderModalAttachments();
    showModal();
  }

  /* ---------- wire DOM events ---------- */
  function wireEvents(){
    if(el('#addTaskBtn')) el('#addTaskBtn').addEventListener('click', openAddModal);
    if(el('#cancelModal')) el('#cancelModal').addEventListener('click', closeModal);
    const modalBack = el('#modalBack'); if(modalBack) modalBack.addEventListener('click', (e)=>{ if(e.target === modalBack) closeModal(); });

    if(el('#addAssigneeBtn') && el('#newAssignee')){
      el('#addAssigneeBtn').addEventListener('click', async ()=>{
        const name = (el('#newAssignee').value||'').trim();
        if(!name) { alert('Enter a name'); return; }
        const added = await addEmployee(name);
        if(!added) { alert('Name exists or invalid'); return; }
        el('#newAssignee').value = '';
      });
    }

    if(el('#fileInput')){
      el('#fileInput').addEventListener('change', (ev)=>{
        const files = Array.from(ev.target.files);
        files.forEach(f => modalAttachments.push({ id: uuid('file'), file: f, name: f.name, external:false }));
        renderModalAttachments();
        ev.target.value = '';
      });
    }

    if(el('#addLinkBtn')){
      el('#addLinkBtn').addEventListener('click', ()=>{
        const url = (el('#addLinkInput') && el('#addLinkInput').value||'').trim();
        const label = (el('#addLinkLabel') && el('#addLinkLabel').value||'').trim();
        if(!url) { alert('Enter URL'); return; }
        modalAttachments.push({ id: uuid('link'), external:true, url, name: label||url });
        renderModalAttachments();
        if(el('#addLinkInput')) el('#addLinkInput').value = '';
        if(el('#addLinkLabel')) el('#addLinkLabel').value = '';
      });
    }

    if(el('#saveTaskBtn')){
      el('#saveTaskBtn').addEventListener('click', async ()=>{
        const title = (el('#taskTitle').value||'').trim();
        if(!title) return alert('Title required');
        const details = el('#taskDetails').value||'';
        const assignedId = el('#assignTo').value || null;
        const assignedName = el('#assignTo').selectedOptions ? el('#assignTo').selectedOptions[0].textContent : '';
        const deadline = el('#deadline').value || null;
        const status = el('#statusSelect').value || 'Open';

        if(editingId){
          await updateTask(editingId, { title, details, assignedId, assignedName, deadline, status });
          // handle attachments
          await saveModalAttachments(editingId);
        } else {
          const id = await createTask({ title, details, assignedId, assignedName, deadline, status });
          await saveModalAttachments(id);
        }
        closeModal();
      });
    }

    ['#searchInput','#statusFilter','#dateFilter','#assignedFilter'].forEach(sel=>{
      const n = el(sel); if(n) n.addEventListener('input', ()=>{/* UI updates by listener */});
    });

    if(el('#exportBtn')){
      el('#exportBtn').addEventListener('click', async ()=>{
        const snap = await getDocs(query(collection(db,'tasks'), orderBy('createdAt','desc')));
        const rows = [['Title','Details','Assigned','Created At','Deadline','Status','Attachments']];
        for(const d of snap.docs){
          const t = d.data();
          const ats = await getDocs(collection(db,'tasks',d.id,'attachments'));
          rows.push([t.title, t.details||'', t.assignedName||'', t.createdAt && t.createdAt.toDate ? t.createdAt.toDate().toLocaleString() : '', t.deadline||'', t.status||'', ats.size]);
        }
        const csv = rows.map(r=>r.map(c=>`"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'tasks-export.csv'; a.click(); URL.revokeObjectURL(url);
      });
    }
  }

  // Save attachments (upload files to storage & add link docs)
  async function saveModalAttachments(taskId){
    // files
    const files = modalAttachments.filter(a => a.file).map(a=>a.file);
    if(files.length) await uploadFiles(taskId, files);
    // links
    const links = modalAttachments.filter(a => a.external && a.url);
    for(const l of links){
      await addExternalLink(taskId, l.url, l.name);
    }
    modalAttachments = [];
  }

  /* ---------- Populate employee selects when employees change ---------- */
  function populateEmployeeSelects(emps){
    const assignTo = el('#assignTo');
    const assignedFilter = el('#assignedFilter');
    if(!assignTo || !assignedFilter) return;
    assignTo.innerHTML = '';
    assignedFilter.innerHTML = '<option value="">All assignees</option>';
    emps.forEach(e=>{
      const opt = document.createElement('option'); opt.value = e.id; opt.textContent = e.name; assignTo.appendChild(opt);
      const opt2 = opt.cloneNode(true); assignedFilter.appendChild(opt2);
    });
  }

  /* ---------- Start realtime listeners ---------- */
  function startRealtime(){
    listenEmployees(emps => populateEmployeeSelects(emps));
    listenTasks(tasks => renderTasks(tasks));
  }

  /* ---------- Init ---------- */
  function init(){
    wireEvents();
    startRealtime();
  }

  init();

  // Expose for debugging
  window._taskApp = {
    createTask, updateTask, deleteTask, addEmployee, uploadFiles, addExternalLink
  };

})(); // end module
