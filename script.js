/* ---------------- Fixed script.js ----------------
   Fully working employee add flow + tasks logic.
   Replace your current script.js with this file.
---------------------------------------------------*/

(() => {
  const STORAGE_KEY = "task_manager_tasks";
  const EMP_KEY = "task_manager_employees";

  // Starter employees (seeded only on very first run)
  const starterEmployees = [
    { id: "emp-1", name: "James O'Brian" },
    { id: "emp-2", name: "Adam Baker" },
    { id: "emp-3", name: "Priya Sharma" },
    { id: "emp-4", name: "Mina Patel" }
  ];

  // helpers to select elements
  const el = (s) => document.querySelector(s);
  const els = (s) => Array.from(document.querySelectorAll(s));

  // uuid helper
  function uuid(prefix = 'id') {
    return prefix + '-' + Math.random().toString(36).slice(2, 9);
  }

  /* ---------------- Employees: get/save/add ---------------- */
  function getEmployees() {
    try {
      const raw = localStorage.getItem(EMP_KEY);
      if (!raw) {
        // seed once
        localStorage.setItem(EMP_KEY, JSON.stringify(starterEmployees));
        console.info('[task-manager] seeded starter employees');
        return starterEmployees.slice();
      }
      return JSON.parse(raw);
    } catch (err) {
      console.error('[task-manager] error parsing employees, reseeding', err);
      localStorage.setItem(EMP_KEY, JSON.stringify(starterEmployees));
      return starterEmployees.slice();
    }
  }

  function saveEmployees(list) {
    localStorage.setItem(EMP_KEY, JSON.stringify(list));
  }

  // returns the new employee object on success, null on duplicate/invalid
  function addEmployee(name) {
    if (!name) return null;
    const nm = String(name).trim();
    if (!nm) return null;

    const list = getEmployees();

    // case-insensitive duplicate check
    const exists = list.some(e => e.name.trim().toLowerCase() === nm.toLowerCase());
    if (exists) return null;

    const newEmp = { id: uuid('emp'), name: nm };
    list.push(newEmp);
    saveEmployees(list);
    console.info('[task-manager] added employee', newEmp);
    // update selects
    populateEmployeeSelects();
    return newEmp;
  }

  /* ---------------- Tasks storage ---------------- */
  function getTasks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (e) {
      console.error('[task-manager] error parsing tasks', e);
      return [];
    }
  }
  function saveTasks(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  /* ---------------- Render helpers ---------------- */
  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString();
  }

  function badgeClass(status) {
    if (status === 'Open') return 'badge open';
    if (status === 'In-progress') return 'badge inprogress';
    if (status === 'Waiting client') return 'badge waiting';
    if (status === 'Closed') return 'badge closed';
    return 'badge';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  /* ---------------- Populate employee selects ---------------- */
  function populateEmployeeSelects() {
    const emps = getEmployees();
    const assignTo = el('#assignTo');
    const assignedFilter = el('#assignedFilter');

    if (!assignTo || !assignedFilter) {
      console.warn('[task-manager] missing select elements in DOM');
      return;
    }

    // clear previous options
    assignTo.innerHTML = '';
    assignedFilter.innerHTML = '<option value="">All assignees</option>';

    // create options
    emps.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.name;
      assignTo.appendChild(opt);

      const opt2 = document.createElement('option');
      opt2.value = e.id;
      opt2.textContent = e.name;
      assignedFilter.appendChild(opt2);
    });

    console.debug('[task-manager] populated employee selects (count=' + emps.length + ')');
  }

  /* ---------------- Optional seed tasks (first-run) ---------------- */
  function seedTasksOnce() {
    const t = getTasks();
    if (t.length) return;
    const emps = getEmployees();
    const now = new Date();
    const sample = [
      { title: 'Add social media links to web design', assignee: emps[0], deadlineOffset: 3, status: 'Closed' },
      { title: 'Database not set up correctly', assignee: emps[1], deadlineOffset: 4, status: 'Open' },
      { title: 'Client newest web design', assignee: emps[0], deadlineOffset: 3, status: 'Waiting client' },
      { title: 'Design new business card', assignee: emps[1], deadlineOffset: 5, status: 'In-progress' }
    ];
    const tasks = sample.map(s => {
      const created = new Date(now.getTime() - Math.random() * 5 * 24 * 3600 * 1000);
      const dl = new Date(created.getTime() + s.deadlineOffset * 24 * 3600 * 1000);
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
    console.info('[task-manager] seeded sample tasks');
  }

  /* ---------------- Render tasks ---------------- */
  function renderTasks() {
    const tasks = getTasks().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const q = (el('#searchInput') && el('#searchInput').value.trim().toLowerCase()) || '';
    const status = (el('#statusFilter') && el('#statusFilter').value) || '';
    const date = (el('#dateFilter') && el('#dateFilter').value) || '';
    const assigned = (el('#assignedFilter') && el('#assignedFilter').value) || '';

    const visible = tasks.filter(t => {
      if (status && t.status !== status) return false;
      if (assigned && t.assignedId !== assigned) return false;
      if (date) {
        const createdDate = new Date(t.createdAt).toISOString().slice(0, 10);
        if (createdDate !== date) return false;
      }
      if (q) {
        const hay = (t.title + ' ' + (t.details || '') + ' ' + t.assignedName).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (el('#countLabel')) el('#countLabel').textContent = visible.length + ' tasks';

    const body = el('#tasksBody');
    if (!body) { console.warn('[task-manager] missing tasksBody element'); return; }

    const html = visible.map(t => `
      <tr data-id="${t.id}">
        <td>
          <div class="title">${escapeHtml(t.title)}</div>
          <div class="muted" style="margin-top:6px">${t.details ? escapeHtml(t.details.length > 160 ? t.details.slice(0, 160) + '…' : t.details) : ''}</div>
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

    body.innerHTML = html || `<tr><td colspan="6" class="muted">No tasks found.</td></tr>`;

    // attach handlers
    els('.actions button').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const tr = ev.target.closest('tr');
        if (!tr) return;
        const id = tr.dataset.id;
        const act = ev.target.dataset.action;
        if (act === 'edit') openEditModal(id);
        if (act === 'delete') { if (confirm('Delete this task?')) deleteTask(id); }
      });
    });
  }

  /* ---------------- Task CRUD ---------------- */
  function addTask(task) {
    const tasks = getTasks(); tasks.push(task); saveTasks(tasks); renderTasks();
  }
  function updateTask(updated) {
    const tasks = getTasks(); const idx = tasks.findIndex(t => t.id === updated.id);
    if (idx === -1) return;
    tasks[idx] = updated; saveTasks(tasks); renderTasks();
  }
  function deleteTask(id) {
    saveTasks(getTasks().filter(t => t.id !== id)); renderTasks();
  }

  /* ---------------- Modal & form handling ---------------- */
  let editingId = null;

  function showModal() {
    const back = el('#modalBack');
    if (back) back.style.display = 'flex';
  }
  function closeModal() {
    const back = el('#modalBack');
    if (back) back.style.display = 'none';
    editingId = null;
  }

  function openAddModal() {
    editingId = null;
    if (el('#modalTitle')) el('#modalTitle').textContent = 'Add Task';
    if (el('#taskTitle')) el('#taskTitle').value = '';
    if (el('#taskDetails')) el('#taskDetails').value = '';
    if (el('#statusSelect')) el('#statusSelect').value = 'Open';
    if (el('#deadline')) el('#deadline').value = '';
    const emps = getEmployees();
    if (el('#assignTo') && emps[0]) el('#assignTo').value = emps[0].id;
    showModal();
  }

  function openEditModal(id) {
    const t = getTasks().find(x => x.id === id);
    if (!t) return alert('Task not found');
    editingId = id;
    if (el('#modalTitle')) el('#modalTitle').textContent = 'Edit Task';
    if (el('#taskTitle')) el('#taskTitle').value = t.title;
    if (el('#taskDetails')) el('#taskDetails').value = t.details || '';
    if (el('#statusSelect')) el('#statusSelect').value = t.status || 'Open';
    if (el('#deadline')) el('#deadline').value = t.deadline ? (new Date(t.deadline)).toISOString().slice(0, 10) : '';
    if (el('#assignTo')) el('#assignTo').value = t.assignedId;
    showModal();
  }

  /* ---------------- Wire DOM events after DOM ready ---------------- */
  function wireEvents() {
    // Add task button
    const addTaskBtn = el('#addTaskBtn');
    if (addTaskBtn) addTaskBtn.addEventListener('click', openAddModal);

    // Cancel modal / click outside
    const cancelBtn = el('#cancelModal');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    const modalBack = el('#modalBack');
    if (modalBack) modalBack.addEventListener('click', (e) => { if (e.target === modalBack) closeModal(); });

    // Add assignee button
    const addAssigneeBtn = el('#addAssigneeBtn');
    const newAssigneeInput = el('#newAssignee');
    if (addAssigneeBtn && newAssigneeInput) {
      addAssigneeBtn.addEventListener('click', () => {
        const name = String(newAssigneeInput.value || '').trim();
        if (!name) { alert('Enter a name to add'); return; }
        const added = addEmployee(name);
        if (!added) { alert('Name already exists or is invalid'); return; }
        // clear input and select
        newAssigneeInput.value = '';
        if (el('#assignTo')) el('#assignTo').value = added.id;
        if (el('#assignedFilter')) el('#assignedFilter').value = added.id;
        // re-render tasks (not necessary but keeps UI consistent)
        renderTasks();
      });
    }

    // Save task button
    const saveTaskBtn = el('#saveTaskBtn');
    if (saveTaskBtn) {
      saveTaskBtn.addEventListener('click', () => {
        const title = (el('#taskTitle') && el('#taskTitle').value || '').trim();
        if (!title) return alert('Title is required');
        const details = (el('#taskDetails') && el('#taskDetails').value || '').trim();
        const assignedId = (el('#assignTo') && el('#assignTo').value) || '';
        const emp = getEmployees().find(e => e.id === assignedId);
        const assignedName = emp ? emp.name : '';
        const deadline = (el('#deadline') && el('#deadline').value) ? new Date(el('#deadline').value).toISOString() : '';
        const status = (el('#statusSelect') && el('#statusSelect').value) || 'Open';

        if (editingId) {
          const task = getTasks().find(t => t.id === editingId);
          if (!task) return alert('Task missing');
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
    }

    // Filters and search
    ['#searchInput', '#statusFilter', '#dateFilter', '#assignedFilter'].forEach(sel => {
      const node = el(sel);
      if (node) node.addEventListener('input', renderTasks);
    });

    // Export CSV
    const exportBtn = el('#exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const rows = [['Title', 'Details', 'Assigned', 'Created At', 'Deadline', 'Status']];
        getTasks().forEach(t => {
          rows.push([t.title, t.details, t.assignedName, formatDate(t.createdAt), formatDate(t.deadline), t.status]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'tasks-export.csv'; a.click(); URL.revokeObjectURL(url);
      });
    }
  }

  /* ---------------- Initialization ---------------- */
  function init() {
    // populate selects and seed sample tasks (first-run)
    populateEmployeeSelects();
    seedTasksOnce();
    wireEvents();
    renderTasks();
    console.info('[task-manager] initialized');
  }

  // Run init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

