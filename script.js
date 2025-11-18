

(() => {
  const STORAGE_KEY = "task_manager_tasks";
  const EMP_KEY = "task_manager_employees";
  const MAX_FILE_BYTES = 2.5 * 1024 * 1024; // 2.5 MB per file limit

  const starterEmployees = [
    { id: "emp-1", name: "James O'Brian" },
    { id: "emp-2", name: "Adam Baker" },
    { id: "emp-3", name: "Priya Sharma" },
    { id: "emp-4", name: "Mina Patel" }
  ];

  const el = (s) => document.querySelector(s);
  const els = (s) => Array.from(document.querySelectorAll(s));
  function uuid(prefix = 'id') { return prefix + '-' + Math.random().toString(36).slice(2, 9); }

  /* ---------- employees ---------- */
  function getEmployees() {
    try {
      const raw = localStorage.getItem(EMP_KEY);
      if (!raw) {
        localStorage.setItem(EMP_KEY, JSON.stringify(starterEmployees));
        return starterEmployees.slice();
      }
      return JSON.parse(raw);
    } catch (e) {
      localStorage.setItem(EMP_KEY, JSON.stringify(starterEmployees));
      return starterEmployees.slice();
    }
  }
  function saveEmployees(list) { localStorage.setItem(EMP_KEY, JSON.stringify(list)); }
  function addEmployee(name) {
    if (!name) return null;
    const nm = String(name).trim();
    if (!nm) return null;
    const list = getEmployees();
    if (list.some(e => e.name.trim().toLowerCase() === nm.toLowerCase())) return null;
    const newEmp = { id: uuid('emp'), name: nm };
    list.push(newEmp);
    saveEmployees(list);
    populateEmployeeSelects();
    return newEmp;
  }

  /* ---------- tasks ---------- */
  function getTasks() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch (e) { return []; } }
  function saveTasks(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

  function formatDate(iso) { if (!iso) return '-'; const d = new Date(iso); if (isNaN(d)) return iso; return d.toLocaleDateString(); }
  function badgeClass(status) {
    if (status === 'Open') return 'badge open';
    if (status === 'In-progress') return 'badge inprogress';
    if (status === 'Waiting client') return 'badge waiting';
    if (status === 'Closed') return 'badge closed';
    return 'badge';
  }
  function escapeHtml(str) { if (!str) return ''; return String(str).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;"); }

  /* ---------- attachments state (temporary while modal open) ---------- */
  let tempAttachments = []; // array of attachment objects for the current modal instance
  // attachment: { id, name, type, external (bool), dataUrl?, url? }

  /* ---------- populate employee selects ---------- */
  function populateEmployeeSelects(){
    const emps = getEmployees();
    const assignTo = el('#assignTo');
    const assignedFilter = el('#assignedFilter');
    if(!assignTo || !assignedFilter) return;
    assignTo.innerHTML = '';
    assignedFilter.innerHTML = '<option value="">All assignees</option>';
    emps.forEach(e=>{
      const o = document.createElement('option'); o.value = e.id; o.textContent = e.name; assignTo.appendChild(o);
      const o2 = o.cloneNode(true); assignedFilter.appendChild(o2);
    });
  }

  /* ---------- sample seed ---------- */
  function seedTasksOnce(){
    const t = getTasks();
    if (t.length) return;
    const emps = getEmployees();
    const now = new Date();
    const sample = [
      {title:'Add social media links to web design', assignee:emps[0], deadlineOffset:3, status:'Closed'},
      {title:'Database not set up correctly', assignee:emps[1], deadlineOffset:4, status:'Open'},
      {title:'Client newest web design', assignee:emps[0], deadlineOffset:3, status:'Waiting client'}
    ];
    const tasks = sample.map(s=>{
      const created = new Date(now.getTime() - Math.random()*5*24*3600*1000);
      const dl = new Date(created.getTime() + s.deadlineOffset*24*3600*1000);
      return {
        id: uuid('task'),
        title: s.title,
        details: '',
        assignedId: s.assignee.id,
        assignedName: s.assignee.name,
        createdAt: created.toISOString(),
        deadline: dl.toISOString(),
        status: s.status,
        attachments: [] // start empty
      };
    });
    saveTasks(tasks);
  }

  /* ---------- render tasks ---------- */
  function renderTasks(){
    const tasks = getTasks().slice().sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
    const q = (el('#searchInput') && el('#searchInput').value.trim().toLowerCase()) || '';
    const status = (el('#statusFilter') && el('#statusFilter').value) || '';
    const date = (el('#dateFilter') && el('#dateFilter').value) || '';
    const assigned = (el('#assignedFilter') && el('#assignedFilter').value) || '';

    const visible = tasks.filter(t=>{
      if(status && t.status !== status) return false;
      if(assigned && t.assignedId !== assigned) return false;
      if(date){
        const createdDate = new Date(t.createdAt).toISOString().slice(0,10);
        if(createdDate !== date) return false;
      }
      if(q){
        const hay = (t.title + ' ' + (t.details||'') + ' ' + t.assignedName).toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });

    if (el('#countLabel')) el('#countLabel').textContent = visible.length + ' tasks';
    const body = el('#tasksBody');
    if(!body) return;

    const html = visible.map(t=>`
      <tr data-id="${t.id}">
        <td>
          <div class="title">${escapeHtml(t.title)}</div>
          <div class="muted" style="margin-top:6px">${t.details ? escapeHtml(t.details.length>160 ? t.details.slice(0,160)+'…' : t.details) : ''}</div>
        </td>
        <td>${escapeHtml(t.assignedName)}</td>
        <td class="muted">${formatDate(t.createdAt)}</td>
        <td class="muted">${formatDate(t.deadline)}</td>
        <td><span class="${badgeClass(t.status)}">${escapeHtml(t.status)}</span></td>
        <td>${renderAttachmentsSummary(t.attachments)}</td>
        <td style="text-align:right" class="actions">
          <button data-action="edit">Edit</button>
          <button data-action="delete">Delete</button>
        </td>
      </tr>
    `).join('');

    body.innerHTML = html || `<tr><td colspan="7" class="muted">No tasks found.</td></tr>`;

    // attach row events
    els('.actions button').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        const tr = ev.target.closest('tr');
        if(!tr) return;
        const id = tr.dataset.id;
        const act = ev.target.dataset.action;
        if(act === 'edit') openEditModal(id);
        if(act === 'delete'){ if(confirm('Delete this task?')) deleteTask(id) }
      });
    });

    // attach attachment click handlers (open link/download)
    els('.attach-link').forEach(a=>{
      a.addEventListener('click', (e)=>{
        // default behavior already opens href (data: or url) in new tab
      });
    });
  }

  /* helper to render attachments summary cell */
  function renderAttachmentsSummary(attachments){
    if(!attachments || !attachments.length) return '<span class="muted">—</span>';
    // show up to 2 filenames and a count
    const shown = attachments.slice(0,2).map(att => {
      const nameEsc = escapeHtml(att.name);
      if(att.external){
        return `<a class="attach-link" href="${escapeHtml(att.url)}" target="_blank" rel="noopener noreferrer">${nameEsc}</a>`;
      } else {
        // data URL stored in att.dataUrl
        return `<a class="attach-link" href="${att.dataUrl}" download="${escapeHtml(att.name)}" target="_blank" rel="noopener noreferrer">${nameEsc}</a>`;
      }
    }).join(', ');
    const more = attachments.length > 2 ? ` +${attachments.length - 2}` : '';
    return `<div class="attachments-summary">${shown}${more}</div>`;
  }

  /* ---------- CRUD tasks ---------- */
  function addTask(task){ const tasks = getTasks(); tasks.push(task); saveTasks(tasks); renderTasks(); }
  function updateTask(updated){ const tasks = getTasks(); const i = tasks.findIndex(t=>t.id===updated.id); if(i===-1) return; tasks[i]=updated; saveTasks(tasks); renderTasks(); }
  function deleteTask(id){ saveTasks(getTasks().filter(t=>t.id!==id)); renderTasks(); }

  /* ---------- modal attachments UI ---------- */
  function resetTempAttachments(){ tempAttachments = []; renderTempAttachmentsList(); }
  function renderTempAttachmentsList(){
    const list = el('#attachmentsList');
    if(!list) return;
    list.innerHTML = tempAttachments.map(att=>`
      <div class="attach-pill" data-aid="${att.id}">
        ${att.external ? '🔗' : (att.type && att.type.startsWith('image/') ? '🖼️' : '📎')}
        <a href="${att.external ? escapeHtml(att.url) : att.dataUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(att.name)}</a>
        <button class="attach-remove" data-remove="${att.id}" title="Remove">✕</button>
      </div>
    `).join('') || `<div class="muted">No attachments added.</div>`;

    // attach removal
    els('.attach-remove').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const aid = btn.dataset.remove;
        tempAttachments = tempAttachments.filter(a => a.id !== aid);
        renderTempAttachmentsList();
      });
    });
  }

  /* handle file input: read files as data URLs (small files) */
  function handleFileInput(files){
    if(!files || !files.length) return;
    const allowed = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    // images also allowed via type starting with image/
    Array.from(files).forEach(file=>{
      if(!(file.type.startsWith('image/') || allowed.includes(file.type))){
        alert('Unsupported file type: ' + file.name);
        return;
      }
      if(file.size > MAX_FILE_BYTES){
        alert('File too large (max 2.5MB): ' + file.name);
        console.warn('[task-manager] file too large', file.name, file.size);
        return;
      }
      const reader = new FileReader();
      reader.onload = function(evt){
        const dataUrl = evt.target.result;
        const att = { id: uuid('att'), name: file.name, type: file.type, external: false, dataUrl };
        tempAttachments.push(att);
        renderTempAttachmentsList();
      };
      reader.onerror = function(){
        console.error('File read error', file.name);
        alert('Failed to read file: ' + file.name);
      };
      reader.readAsDataURL(file);
    });
  }

  /* add external link */
  function addExternalLink(url, label){
    if(!url) return alert('Enter a valid URL');
    // basic check
    try {
      const u = new URL(url);
    } catch(e){
      return alert('Invalid URL');
    }
    const att = { id: uuid('att'), name: label ? label.trim() : url.replace(/^https?:\/\//, '').slice(0,60), type: 'link', external: true, url };
    tempAttachments.push(att);
    renderTempAttachmentsList();
  }

  /* ---------- modal open / edit flow ---------- */
  let editingId = null;
  function openAddModal(){
    editingId = null;
    if (el('#modalTitle')) el('#modalTitle').textContent = 'Add Task';
    if (el('#taskTitle')) el('#taskTitle').value = '';
    if (el('#taskDetails')) el('#taskDetails').value = '';
    if (el('#statusSelect')) el('#statusSelect').value = 'Open';
    if (el('#deadline')) el('#deadline').value = '';
    const emps = getEmployees();
    if (el('#assignTo') && emps[0]) el('#assignTo').value = emps[0].id;
    resetTempAttachments();
    showModal();
  }

  function openEditModal(id){
    const t = getTasks().find(x=>x.id===id);
    if(!t) return alert('Task not found');
    editingId = id;
    if (el('#modalTitle')) el('#modalTitle').textContent = 'Edit Task';
    if (el('#taskTitle')) el('#taskTitle').value = t.title;
    if (el('#taskDetails')) el('#taskDetails').value = t.details || '';
    if (el('#statusSelect')) el('#statusSelect').value = t.status || 'Open';
    if (el('#deadline')) el('#deadline').value = t.deadline ? (new Date(t.deadline)).toISOString().slice(0,10) : '';
    if (el('#assignTo')) el('#assignTo').value = t.assignedId;
    // load existing attachments into tempAttachments so user can remove/add
    tempAttachments = (t.attachments || []).map(a => Object.assign({}, a));
    renderTempAttachmentsList();
    showModal();
  }

  function showModal(){ const b = el('#modalBack'); if(b) b.style.display = 'flex'; }
  function closeModal(){ const b = el('#modalBack'); if(b) b.style.display = 'none'; editingId = null; resetTempAttachments(); }

  /* ---------- wire events ---------- */
  function wireEvents(){
    const addTaskBtn = el('#addTaskBtn'); if(addTaskBtn) addTaskBtn.addEventListener('click', openAddModal);
    const cancelBtn = el('#cancelModal'); if(cancelBtn) cancelBtn.addEventListener('click', closeModal);
    const modalBack = el('#modalBack'); if(modalBack) modalBack.addEventListener('click', (e)=>{ if(e.target===modalBack) closeModal(); });

    // add assignee
    const addAssigneeBtn = el('#addAssigneeBtn');
    const newAssigneeInput = el('#newAssignee');
    if(addAssigneeBtn && newAssigneeInput){
      addAssigneeBtn.addEventListener('click', ()=>{
        const nm = (newAssigneeInput.value || '').trim();
        if(!nm) return alert('Enter a name to add');
        const added = addEmployee(nm);
        if(!added) return alert('Name already exists or invalid');
        newAssigneeInput.value = '';
        if(el('#assignTo')) el('#assignTo').value = added.id;
        if(el('#assignedFilter')) el('#assignedFilter').value = added.id;
      });
    }

    // file input handling
    const fileInput = el('#fileInput');
    if(fileInput){
      fileInput.addEventListener('change', (ev)=>{
        handleFileInput(ev.target.files);
        // reset input so selecting same file again will still trigger change
        ev.target.value = '';
      });
    }

    // add link button
    const addLinkBtn = el('#addLinkBtn');
    if(addLinkBtn){
      addLinkBtn.addEventListener('click', ()=>{
        const url = (el('#addLinkInput') && el('#addLinkInput').value || '').trim();
        const label = (el('#addLinkLabel') && el('#addLinkLabel').value || '').trim();
        if(!url) return alert('Enter a URL to add');
        addExternalLink(url, label);
        if(el('#addLinkInput')) el('#addLinkInput').value = '';
        if(el('#addLinkLabel')) el('#addLinkLabel').value = '';
      });
    }

    // save task
    const saveBtn = el('#saveTaskBtn');
    if(saveBtn){
      saveBtn.addEventListener('click', ()=>{
        const title = (el('#taskTitle') && el('#taskTitle').value || '').trim();
        if(!title) return alert('Title is required');
        const details = (el('#taskDetails') && el('#taskDetails').value || '').trim();
        const assignedId = (el('#assignTo') && el('#assignTo').value) || '';
        const emp = getEmployees().find(e=>e.id===assignedId);
        const assignedName = emp ? emp.name : '';
        const deadline = (el('#deadline') && el('#deadline').value) ? new Date(el('#deadline').value).toISOString() : '';
        const status = (el('#statusSelect') && el('#statusSelect').value) || 'Open';

        if(editingId){
          const task = getTasks().find(t=>t.id === editingId);
          if(!task) return alert('Task missing');
          task.title = title; task.details = details; task.assignedId = assignedId; task.assignedName = assignedName;
          task.deadline = deadline; task.status = status; task.attachments = tempAttachments.slice();
          updateTask(task);
        } else {
          const newTask = {
            id: uuid('task'),
            title, details,
            assignedId, assignedName,
            createdAt: new Date().toISOString(),
            deadline, status,
            attachments: tempAttachments.slice()
          };
          addTask(newTask);
        }
        closeModal();
      });
    }

    // filters
    ['#searchInput','#statusFilter','#dateFilter','#assignedFilter'].forEach(sel=>{
      const n = el(sel); if(n) n.addEventListener('input', renderTasks);
    });

    // export CSV (attachments excluded - CSV can't carry binary)
    const exportBtn = el('#exportBtn');
    if(exportBtn){
      exportBtn.addEventListener('click', ()=>{
        const rows = [['Title','Details','Assigned','Created At','Deadline','Status','AttachmentsCount','AttachmentLinks']];
        getTasks().forEach(t=>{
          const count = (t.attachments || []).length;
          const links = (t.attachments || []).map(a => a.external ? a.url : (a.dataUrl ? '[embedded]' : '')).join(' | ');
          rows.push([t.title, t.details, t.assignedName, formatDate(t.createdAt), formatDate(t.deadline), t.status, count, links]);
        });
        const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'tasks-export.csv'; a.click(); URL.revokeObjectURL(url);
      });
    }
  }

  /* ---------- init ---------- */
  function init(){
    populateEmployeeSelects();
    seedTasksOnce();
    wireEvents();
    renderTasks();
  }

  // DOM ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
