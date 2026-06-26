(() => {
  const form = document.getElementById('task-form');
  const titleInput = document.getElementById('title');
  const noteInput = document.getElementById('note');
  const dueInput = document.getElementById('due');
  const priorityInput = document.getElementById('priority');
  const filterSelect = document.getElementById('filter');
  const priorityFilter = document.getElementById('priority-filter');
  const listEl = document.getElementById('task-list');
  const editEl = document.getElementById('task-edit');
  const error = document.getElementById('error-message');

  // ===== モーダル =====
  const modal = document.getElementById('modal');
  const addButton = document.getElementById('add-button');
  const closeButton = document.getElementById('close-modal');

  let editing = false;
  let editing_task_index = -1;
  let error_message = '';
  let title_error_indicate = false;

  const STORAGE_KEY = 'todoTasks_v1';
  let tasks = [];

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  }

  function escapeHtml(s){
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }

  // ===== モーダル =====

  function openModal(){
    modal.classList.remove('hidden');
  }

  function closeModal(){
    modal.classList.add('hidden');
  }

  function createTaskElement(task, idx){
    const li = document.createElement('li');
    li.className = 'task' + (task.completed ? ' completed' : '');
    const left = document.createElement('div');
    left.className = 'left';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.index = idx;
    checkbox.checked = !!task.completed;
    const info = document.createElement('div');
    info.className = 'info';
    const title = document.createElement('div');
    title.className = 'title';
    title.innerHTML = escapeHtml(task.title);
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = '';
    let metaText = '';
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = (task.note || '');
    info.appendChild(title);
    info.appendChild(note);
    info.appendChild(meta);
    left.appendChild(checkbox);
    left.appendChild(info);

    if(task.note){
      metaText += task.note;
    }

    if(task.due){
      if(metaText !== '') metaText += ' • ';
      metaText += task.due;
    }

    if(task.priority){
      if(metaText !== '') metaText += ' • ';
      metaText += task.priority;
    }

    meta.textContent = metaText;
    const actions = document.createElement('div');
    actions.className = 'actions';

    const edit = document.createElement('button');
    edit.className = 'edit';
    edit.dataset.index = idx;
    edit.textContent = '編集';

    actions.appendChild(edit);

    const del = document.createElement('button');
    del.className = 'delete';
    del.dataset.index = idx;
    del.textContent = '削除';

    actions.appendChild(del);

    li.appendChild(left);
    li.appendChild(actions);

    return li;
  }
    function render() {
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

  function attachListeners() {

    // 完了チェック
    listEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', e => {
        const i = Number(e.target.dataset.index);
        tasks[i].completed = e.target.checked;
        save();
        render();
      });

    });

    // 削除
    listEl.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', e => {
        const i = Number(e.target.dataset.index);
        tasks.splice(i, 1);
        save();
        render();
      });
    });

    // 編集
    listEl.querySelectorAll('.edit').forEach(btn => {
      btn.addEventListener('click', e => {
        editing = true;
        const i = Number(e.target.dataset.index);
        editing_task_index = i;
        const task = tasks[i];
        titleInput.value = task.title;
        noteInput.value = task.note || '';
        dueInput.value = task.due || '';
        priorityInput.value = task.priority || 'medium';
        openModal();
      });
    });
  }

  // ==========================
  // モーダル
  // ==========================

  addButton.addEventListener('click', () => {
    form.reset();
    editing = false;
    editing_task_index = -1;
    error.textContent = '';
    titleInput.classList.remove('active');
    openModal();
  });

  closeButton.addEventListener('click', () => {
    closeModal();
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) {
      closeModal();
    }

  });

  // ==========================
  // 入力中はエラー解除
  // ==========================

  titleInput.addEventListener('input', () => {
    error.textContent = '';
    titleInput.classList.remove('active');
  });

  // ==========================
  // タスク追加
  // ==========================

  form.addEventListener('submit', e => {

    e.preventDefault();

    const title = titleInput.value.trim();
    const note = noteInput.value.trim();
    if (!title) {
      error.textContent = 'タスク名を入力してください';
      titleInput.classList.add('active');
      return;
    }

    const task = {
      title,
      note,
      due: dueInput.value || null,
      priority: priorityInput.value || 'medium',
      completed: false
    };

    if (editing) {
      task.completed = tasks[editing_task_index].completed;
      tasks[editing_task_index] = task;
      editing = false;
      editing_task_index = -1;
    } else {
      tasks.push(task);
      save();
      render();
      form.reset();
      closeModal();
    }
  });

  filterSelect.addEventListener('change', render);
  priorityFilter.addEventListener('change', render);

  // ==========================
  // 初期化
  // ==========================
  load();
  render();
  closeModal();
})();