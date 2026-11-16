// TaskFlow — plain JavaScript, no dependencies.
// Tasks persist in localStorage, so they survive reloads.

const STORAGE_KEY = 'taskflow.tasks.v1';

let tasks = load();
let statusFilter = 'all'; // all | active | completed
let listFilter = 'all';   // all | Personal | Work

const listEl = document.getElementById('task-list');
const emptyEl = document.getElementById('empty-state');
const emptyTitleEl = document.getElementById('empty-title');
const emptyTextEl = document.getElementById('empty-text');
const statsEl = document.getElementById('stats');
const form = document.getElementById('add-form');
const input = document.getElementById('task-input');
const dueInput = document.getElementById('due-input');
const listSelect = document.getElementById('list-select');
const clearBtn = document.getElementById('clear-completed');

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidTask) : [];
  } catch (e) {
    return [];
  }
}

function isValidTask(t) {
  return t && typeof t.id === 'string' && typeof t.text === 'string';
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function formatDue(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(t) {
  if (t.done || !t.due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(t.due + 'T00:00:00') < today;
}

function visibleTasks() {
  return tasks.filter(function (t) {
    if (statusFilter === 'active' && t.done) return false;
    if (statusFilter === 'completed' && !t.done) return false;
    if (listFilter !== 'all' && t.list !== listFilter) return false;
    return true;
  });
}

function render() {
  const visible = visibleTasks();

  listEl.innerHTML = visible.map(function (t) {
    return '' +
      '<li class="task' + (t.done ? ' done' : '') + '" data-id="' + escapeHtml(t.id) + '">' +
        '<input type="checkbox" class="toggle"' + (t.done ? ' checked' : '') + ' aria-label="Mark complete">' +
        '<span class="task-text">' + escapeHtml(t.text) + '</span>' +
        '<span class="task-meta">' +
          '<span class="tag">' + escapeHtml(t.list) + '</span>' +
          (t.due
            ? '<span class="due' + (isOverdue(t) ? ' overdue' : '') + '">Due ' + escapeHtml(formatDue(t.due)) + '</span>'
            : '') +
        '</span>' +
        '<button type="button" class="icon-btn edit" aria-label="Edit task" title="Edit">&#9998;</button>' +
        '<button type="button" class="icon-btn delete" aria-label="Delete task" title="Delete">&times;</button>' +
      '</li>';
  }).join('');

  if (visible.length === 0) {
    emptyEl.style.display = 'block';
    if (tasks.length === 0) {
      emptyTitleEl.textContent = 'No tasks yet';
      emptyTextEl.textContent = 'Add your first task above to get started.';
    } else {
      emptyTitleEl.textContent = 'Nothing here';
      emptyTextEl.textContent = 'No tasks match the selected filters.';
    }
  } else {
    emptyEl.style.display = 'none';
  }

  const active = tasks.filter(function (t) { return !t.done; }).length;
  const done = tasks.length - active;
  statsEl.textContent = tasks.length === 0
    ? ''
    : active + ' active \u00b7 ' + done + ' completed';
  clearBtn.style.display = done > 0 ? 'inline-block' : 'none';
}

form.addEventListener('submit', function (e) {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  tasks.unshift({
    id: uid(),
    text: text,
    done: false,
    due: dueInput.value || '',
    list: listSelect.value,
    created: Date.now()
  });
  save();
  render();
  input.value = '';
  dueInput.value = '';
  input.focus();
});

listEl.addEventListener('click', function (e) {
  const li = e.target.closest('li.task');
  if (!li) return;
  const id = li.dataset.id;
  const task = tasks.find(function (t) { return t.id === id; });
  if (!task) return;

  if (e.target.classList.contains('toggle')) {
    task.done = e.target.checked;
    save();
    render();
  } else if (e.target.classList.contains('delete')) {
    tasks = tasks.filter(function (t) { return t.id !== id; });
    save();
    render();
  } else if (e.target.classList.contains('edit')) {
    startEdit(li, task);
  }
});

function startEdit(li, task) {
  const span = li.querySelector('.task-text');
  const edit = document.createElement('input');
  edit.type = 'text';
  edit.className = 'edit-input';
  edit.value = task.text;
  edit.maxLength = 200;
  edit.setAttribute('aria-label', 'Edit task text');
  span.replaceWith(edit);
  edit.focus();
  edit.setSelectionRange(edit.value.length, edit.value.length);

  let finished = false;
  const commit = function (saveIt) {
    if (finished) return;
    finished = true;
    const v = edit.value.trim();
    if (saveIt && v) {
      task.text = v;
      save();
    }
    render();
  };
  edit.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') commit(true);
    else if (e.key === 'Escape') commit(false);
  });
  edit.addEventListener('blur', function () { commit(true); });
}

document.getElementById('status-filters').addEventListener('click', function (e) {
  const btn = e.target.closest('[data-filter]');
  if (!btn) return;
  statusFilter = btn.dataset.filter;
  document.querySelectorAll('#status-filters .filter-btn').forEach(function (b) {
    b.classList.toggle('active', b === btn);
  });
  render();
});

document.getElementById('list-filters').addEventListener('click', function (e) {
  const btn = e.target.closest('[data-list]');
  if (!btn) return;
  listFilter = btn.dataset.list;
  document.querySelectorAll('#list-filters .filter-btn').forEach(function (b) {
    b.classList.toggle('active', b === btn);
  });
  render();
});

clearBtn.addEventListener('click', function () {
  tasks = tasks.filter(function (t) { return !t.done; });
  save();
  render();
});

render();
