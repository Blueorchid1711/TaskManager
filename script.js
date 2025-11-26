/* ---------------- script.js (fixed) ----------------
   Replaces the previous script.js. Fixes add-person flow so
   newly added names are persisted to localStorage and shown
   immediately in both assign dropdown and assigned filter.
---------------------------------------------------*/

const STORAGE_KEY = "task_manager_tasks";
const EMP_KEY = "task_manager_employees";

/* starter employees (only used on first-run) */
const starterEmployees = [
  { id: "emp-1", name: "Arya Shinde" },
  { id: "emp-2", name: "Girisha Anamala" },
  { id: "emp-3", name: "Tharun Naidu" }
];

const el = (s) => document.querySelector(s);
const els = (s) => Array.from(document.querySelectorAll(s));

function uuid(prefix='id') { return prefix + '-' + Math.random().toString(36).slice(2,9); }

/* ---------------- Employees CRUD (localStorage) ---------------- */
function getEmployees(){
  const raw = localStorage.getItem(EMP_KEY);
  if(!raw) {
    // seed initial employees (only once)
    localStorage.setItem(EMP_KEY, JSON.stringify(starterEmployees));
    return starterEmployees.slice();
  }
  try { return JSON.parse(raw); } catch(e) { return starterEmployees.slice(); }
}

function saveEmployees(list){
  localStorage.setItem(EMP_KEY, JSON.stringify(list));
}

/* addEmployee returns the created employee object on success, or null on failure (duplicate/invalid) */
function addEmployee(name){
  if(!name) return null;
  const nm = String(name).trim();
  if(!nm) return null;

  const list = getEmployees();

  // case-insensitive duplicate check
  const exists = list.some(e => e.name.trim().toLowerCase() === nm.toLowerCase());
  if(exists) return null;

  const newEmp = { id: uuid('emp'), name: nm };
  list.push(newEmp);
  saveEmployees(list);
  // update selects immediately
  populateEmployeeSelects();
  return newEmp;
}

/* ---------------- Tasks storage ---------------- */
function getTasks(){ return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
function saveTasks(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

/* ---------------- Helpers ---------------- */
function formatDate(iso){ if(!iso) return '-'; const d = new Date(iso); if(isNaN(d)) return iso; return d.toLocaleDateString(); }
function badgeClass(status){
  if(status === 'Open') return 'badge open';
  if(status === 'In-progress') return 'badge inprogress';
  if(status === 'Waiting client') return 'badge waiting';
  if(status === 'Closed') return 'badge closed';
  return 'badge';
}

/* ---------------- UI population ---------------- */
function populateEmployeeSelects(){
  const emps = getEmployees();
  const assignTo = el('#assignTo');
  const assignedFilter = el('#assignedFilter');

  // clear existing options
  assignTo.innerHTML = '';
  assignedFilter.innerHTML = '<option value="">All assignees</option>';

  // populate new options
  emps.forEach(e=>{
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.name;
    assignTo.appendChild(opt);

    const opt2 = document.createElement('option');
    opt2.value = e.id;
    opt2.textContent = e.name;
    assignedFilter.appendChild(opt2);
  });
}

/* ---------------- Optional seed tasks (first-run) ---------------- */
function seedTasksOnce(){
  const t = getTasks();
  if(t.length) return;
  const emps = getEmployees();
  const now = new Date();
  const sample = [
    {title:'Add social media links to web design', assignee:emps[0], deadlineOffset:3, status:'Closed'},
    {title:'Database not set up correctly', assignee:emps[1], deadlineOffset:4, status:'Open'},
    {title:'Client newest web design', assignee:emps[0], deadlineOffset:3, status:'Waiting client'},
    {title:'Design new business card', assignee:emps[1], deadlineOffset:5, status:'In-progress'}
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
      status: s.status
    };
  });
  saveTasks(tasks);
}

/* ---------------- Render Tasks ---------------- */
function renderTasks(){
  const tasks = getTasks().slice().sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  const q = el('#searchInput').value.trim().toLowerCase();
  const status = el('#statusFilter').value;
  const date = el('#dateFilter').value;
  const assigned = el('#assignedFilter').value;

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

  el('#countLabel').textContent = visible.length + ' tasks';

  const html = visible.map(t=>`
    <tr data-id="${t.id}">
      <td>
        <div class="title">${escapeHtml(t.title)}</div>
        <div class="muted" style="margin-top:6px">${t.details ? (escapeHtml(t.details.length>160 ? t.details.slice(0,160)+'…' : t.details)) : ''}</div>
      </td>
      <td>${escapeHtml(t.assignedName)}</td>
      <td class="muted">${formatDate(t.createdAt)}</td>
      <td class="muted">${formatDate(t.deadline)}</td>
      <td><span class="${badgeClass(t.status)}">${escapeHtml(t.status)}</span></td>
      <td style="text-align:right" class="actions">
        <button data-action="edit">Edit</button>
        <button data-action="delete">Delete</button>
      </td>
    </tr>
  `).join('');

  el('#tasksBody').innerHTML = html || `<tr><td colspan="6" class="muted">No tasks found.</td></tr>`;

  // attach handlers
  els('.actions button').forEach(btn=>{
    btn.addEventListener('click', (ev)=>{
      const tr = ev.target.closest('tr');
      const id = tr.dataset.id;
      const act = ev.target.dataset.action;
      if(act === 'edit') openEditModal(id);
      if(act === 'delete'){ if(confirm('Delete this task?')) deleteTask(id) }
    });
  });
}

/* safe text escape to avoid accidental html injection when rendering */
function escapeHtml(str){
  if(!str) return '';
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'", '&#39;');
}

/* ---------------- Task CRUD ---------------- */
function addTask(task){
  const tasks = getTasks(); tasks.push(task); saveTasks(tasks); renderTasks();
}
function updateTask(updated){
  const tasks = getTasks(); const i = tasks.findIndex(t=>t.id === updated.id);
  if(i===-1) return; tasks[i] = updated; saveTasks(tasks); renderTasks();
}
function deleteTask(id){
  saveTasks(getTasks().filter(t=>t.id !== id)); renderTasks();
}

/* ---------------- Modal & form handling ---------------- */
const modalBack = el('#modalBack');
const addTaskBtn = el('#addTaskBtn');
const saveTaskBtn = el('#saveTaskBtn');
const cancelModal = el('#cancelModal');
const addAssigneeBtn = el('#addAssigneeBtn');
const newAssigneeInput = el('#newAssignee');

let editingId = null;

addTaskBtn.addEventListener('click', ()=> openAddModal());
cancelModal.addEventListener('click', closeModal);
modalBack.addEventListener('click', (e)=> { if(e.target === modalBack) closeModal(); });

/* Add assignee button handler: uses addEmployee and handles feedback */
addAssigneeBtn.addEventListener('click', ()=>{
  const name = (newAssigneeInput.value || '').trim();
  if(!name) {
    alert('Enter a name to add');
    return;
  }
  const added = addEmployee(name);
  if(!added){
    alert('Name already exists or is invalid');
    return;
  }
  // clear input and select newly added person
  newAssigneeInput.value = '';
  // select in assignTo dropdown
  const assignTo = el('#assignTo');
  if(assignTo){
    assignTo.value = added.id;
  }
  // also select in assignedFilter for convenience
  const assignedFilter = el('#assignedFilter');
  if(assignedFilter){
    assignedFilter.value = added.id;
  }
});

function openAddModal(){
  editingId = null;
  el('#modalTitle').textContent = 'Add Task';
  el('#taskTitle').value = '';
  el('#taskDetails').value = '';
  el('#statusSelect').value = 'Open';
  el('#deadline').value = '';
  const emps = getEmployees();
  el('#assignTo').value = emps[0]?.id || '';
  showModal();
}

function openEditModal(id){
  const t = getTasks().find(x => x.id === id);
  if(!t) return alert('Task not found');
  editingId = id;
  el('#modalTitle').textContent = 'Edit Task';
  el('#taskTitle').value = t.title;
  el('#taskDetails').value = t.details || '';
  el('#statusSelect').value = t.status || 'Open';
  el('#deadline').value = t.deadline ? (new Date(t.deadline)).toISOString().slice(0,10) : '';
  el('#assignTo').value = t.assignedId;
  showModal();
}

function showModal(){ modalBack.style.display = 'flex'; }
function closeModal(){ modalBack.style.display = 'none'; editingId = null; }

saveTaskBtn.addEventListener('click', ()=>{
  const title = (el('#taskTitle').value || '').trim();
  if(!title) return alert('Title is required');
  const details = (el('#taskDetails').value || '').trim();
  const assignedId = el('#assignTo').value;
  const emp = getEmployees().find(e=>e.id === assignedId);
  const assignedName = emp ? emp.name : '';
  const deadline = el('#deadline').value ? new Date(el('#deadline').value).toISOString() : '';
  const status = el('#statusSelect').value || 'Open';

  if(editingId){
    const task = getTasks().find(t=>t.id === editingId);
    if(!task) return alert('Task missing');
    task.title = title; task.details = details; task.assignedId = assignedId; task.assignedName = assignedName;
    task.deadline = deadline; task.status = status;
    updateTask(task);
  } else {
    const newTask = {
      id: uuid('task'),
      title, details,
      assignedId, assignedName,
      createdAt: new Date().toISOString(),
      deadline, status
    };
    addTask(newTask);
  }
  closeModal();
});

/* ---------------- Filters & export ---------------- */
['#searchInput','#statusFilter','#dateFilter','#assignedFilter'].forEach(sel=>{
  const node = el(sel);
  if(node) node.addEventListener('input', renderTasks);
});

el('#exportBtn').addEventListener('click', ()=>{
  const rows = [['Title','Details','Assigned','Created At','Deadline','Status']];
  getTasks().forEach(t=>{
    rows.push([t.title, t.details, t.assignedName, formatDate(t.createdAt), formatDate(t.deadline), t.status]);
  });
  const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'tasks-export.csv'; a.click(); URL.revokeObjectURL(url);
});

/* ---------------- Init ---------------- */
(function init(){
  populateEmployeeSelects();
  seedTasksOnce();
  renderTasks();
})();
