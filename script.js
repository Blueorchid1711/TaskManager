/* ---------------- Data Storage ---------------- */
const STORAGE_KEY = "task_manager_tasks";
const EMP_KEY = "task_manager_employees";

const sampleEmployees = [
  { id: "emp1", name: "James O'Brian" },
  { id: "emp2", name: "Adam Baker" },
  { id: "emp3", name: "Priya Sharma" },
];

const el = (s) => document.querySelector(s);
const els = (s) => document.querySelectorAll(s);

function uuid() {
  return "id-" + Math.random().toString(36).substring(2, 10);
}

function readEmployees() {
  const data = localStorage.getItem(EMP_KEY);
  if (!data) {
    localStorage.setItem(EMP_KEY, JSON.stringify(sampleEmployees));
    return sampleEmployees;
  }
  return JSON.parse(data);
}

function readTasks() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function writeTasks(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString();
}

/* ---------------- UI Rendering ---------------- */

function renderEmployees() {
  const emps = readEmployees();
  const assignTo = el("#assignTo");
  const filter = el("#assignedFilter");

  assignTo.innerHTML = "";
  filter.innerHTML = '<option value="">All assignees</option>';

  emps.forEach((e) => {
    assignTo.innerHTML += `<option value="${e.id}">${e.name}</option>`;
    filter.innerHTML += `<option value="${e.id}">${e.name}</option>`;
  });
}

function badge(status) {
  return `
    <span class="badge ${
      status === "Open"
        ? "open"
        : status === "Closed"
        ? "closed"
        : status === "In-progress"
        ? "inprogress"
        : "waiting"
    }">${status}</span>`;
}

function renderTasks() {
  const tasks = readTasks();
  const q = el("#searchInput").value.toLowerCase();
  const status = el("#statusFilter").value;
  const date = el("#dateFilter").value;
  const assigned = el("#assignedFilter").value;

  const filtered = tasks.filter((t) => {
    if (status && t.status !== status) return false;
    if (assigned && t.assignedId !== assigned) return false;
    if (date && t.createdAt.slice(0, 10) !== date) return false;

    const hay = (t.title + " " + t.details + " " + t.assignedName).toLowerCase();
    if (q && !hay.includes(q)) return false;

    return true;
  });

  el("#countLabel").textContent = filtered.length + " tasks";

  el("#tasksBody").innerHTML =
    filtered
      .map(
        (t) => `
    <tr data-id="${t.id}">
      <td>${t.title}<br><span class="muted">${t.details}</span></td>
      <td>${t.assignedName}</td>
      <td>${formatDate(t.createdAt)}</td>
      <td>${formatDate(t.deadline)}</td>
      <td>${badge(t.status)}</td>
      <td class="actions">
        <button data-action="edit">Edit</button>
        <button data-action="delete">Delete</button>
      </td>
    </tr>
  `
      )
      .join("") || `<tr><td colspan="6" class="muted">No tasks found.</td></tr>`;

  attachRowEvents();
}

/* ---------------- CRUD ---------------- */

function attachRowEvents() {
  document.querySelectorAll(".actions button").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.closest("tr").dataset.id;
      if (btn.dataset.action === "delete") deleteTask(id);
      else editTask(id);
    };
  });
}

function addTask(data) {
  const tasks = readTasks();
  tasks.push(data);
  writeTasks(tasks);
  renderTasks();
}

function editTask(id) {
  const tasks = readTasks();
  const t = tasks.find((x) => x.id === id);
  if (!t) return;

  el("#modalTitle").textContent = "Edit Task";
  el("#taskTitle").value = t.title;
  el("#taskDetails").value = t.details;
  el("#assignTo").value = t.assignedId;
  el("#deadline").value = t.deadline ? t.deadline.slice(0, 10) : "";
  el("#statusSelect").value = t.status;

  currentEdit = id;
  showModal();
}

function deleteTask(id) {
  if (!confirm("Delete this task?")) return;
  writeTasks(readTasks().filter((t) => t.id !== id));
  renderTasks();
}

/* ---------------- Modal ---------------- */
let currentEdit = null;

function showModal() {
  el("#modalBack").style.display = "flex";
}

function closeModal() {
  el("#modalBack").style.display = "none";
  currentEdit = null;
}

el("#addTaskBtn").onclick = () => {
  currentEdit = null;
  el("#modalTitle").textContent = "Add Task";
  el("#taskTitle").value = "";
  el("#taskDetails").value = "";
  el("#deadline").value = "";
  el("#statusSelect").value = "Open";
  showModal();
};

el("#cancelModal").onclick = closeModal;

el("#saveTaskBtn").onclick = () => {
  const title = el("#taskTitle").value.trim();
  if (!title) return alert("Title required");

  const details = el("#taskDetails").value;
  const assignedId = el("#assignTo").value;
  const assignedName = readEmployees().find((e) => e.id === assignedId).name;
  const deadline = el("#deadline").value
    ? new Date(el("#deadline").value).toISOString()
    : "";

  const status = el("#statusSelect").value;

  if (currentEdit) {
    let tasks = readTasks();
    let t = tasks.find((x) => x.id === currentEdit);
    t.title = title;
    t.details = details;
    t.assignedId = assignedId;
    t.assignedName = assignedName;
    t.deadline = deadline;
    t.status = status;
    writeTasks(tasks);
  } else {
    addTask({
      id: uuid(),
      title,
      details,
      assignedId,
      assignedName,
      createdAt: new Date().toISOString(),
      deadline,
      status,
    });
  }

  closeModal();
  renderTasks();
};

/* ---------------- Filters ---------------- */
["#searchInput", "#statusFilter", "#dateFilter", "#assignedFilter"].forEach((id) => {
  el(id).addEventListener("input", renderTasks);
});

/* ---------------- Export CSV ---------------- */
el("#exportBtn").onclick = () => {
  const rows = [["Title", "Details", "Assigned", "Created", "Deadline", "Status"]];
  readTasks().forEach((t) =>
    rows.push([
      t.title,
      t.details,
      t.assignedName,
      formatDate(t.createdAt),
      formatDate(t.deadline),
      t.status,
    ])
  );

  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "tasks.csv";
  a.click();
  URL.revokeObjectURL(url);
};

/* ---------------- Init ---------------- */
renderEmployees();
renderTasks();

