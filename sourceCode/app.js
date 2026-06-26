(() => {
  const form = document.getElementById('task-form');
  const titleInput = document.getElementById('title');
  const dueInput = document.getElementById('due');
  const priorityInput = document.getElementById('priority');
  const filterSelect = document.getElementById('filter');
  const priorityFilter = document.getElementById('priority-filter');
  const listEl = document.getElementById('task-list');

  const STORAGE_KEY = 'todoTasks_v1';
  let tasks = [];

  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
  function load() { const raw = localStorage.getItem(STORAGE_KEY); tasks = raw ? JSON.parse(raw) : []; }

  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function createTaskElement(task, idx){
    const li = document.createElement('li');
    li.className = 'task' + (task.completed ? ' completed' : '');

    const left = document.createElement('div'); left.className = 'left';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.dataset.index = idx; checkbox.checked = !!task.completed;
    const info = document.createElement('div'); info.className = 'info';
    const title = document.createElement('div'); title.className = 'title'; title.innerHTML = escapeHtml(task.title);
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = (task.priority || '') + (task.due ? ' • ' + task.due : '');

    info.appendChild(title); info.appendChild(meta);
    left.appendChild(checkbox); left.appendChild(info);

    const actions = document.createElement('div'); actions.className = 'actions';
    const del = document.createElement('button'); del.className = 'delete'; del.dataset.index = idx; del.textContent = '削除';
    actions.appendChild(del);

    li.appendChild(left); li.appendChild(actions);
    return li;
  }

  function render(){
    const filter = filterSelect.value;
    const priority = priorityFilter.value;

    listEl.innerHTML = '';

    tasks.forEach((t,i) => {
      if(filter === 'active' && t.completed) return;
      if(filter === 'completed' && !t.completed) return;

      if(priority !== 'all' && t.priority !== priority) return;
      
      listEl.appendChild(createTaskElement(t,i));
    });
    attachListeners();
  }

  function attachListeners(){
    listEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', e => {
      const i = Number(e.target.dataset.index); tasks[i].completed = e.target.checked; save(); render();
    }));
    listEl.querySelectorAll('.delete').forEach(btn => btn.addEventListener('click', e => {
      const i = Number(e.target.dataset.index); tasks.splice(i,1); save(); render();
    }));
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if(!title){ alert('タスク名を入力してください'); return; }
    if(title.length > 140){ alert('タスク名は140字以内です'); return; }
    const task = { title, due: dueInput.value || null, priority: priorityInput.value || 'medium', completed: false };
    tasks.push(task); save(); render(); form.reset(); titleInput.focus();
  });

  filterSelect.addEventListener('change', render);
  priorityFilter.addEventListener('change', render);

  // init
  load(); render();
})();
