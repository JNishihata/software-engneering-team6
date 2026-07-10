// ToDoアプリ本体。localStorageへの永続化とタスクの一覧表示・追加・編集・削除・フィルタリングを担う。
// グローバルスコープを汚さないよう即時実行関数（IIFE）で全体を包んでいる。
(() => {
  // index.html内の要素をあらかじめ取得しておく
  const form = document.getElementById('task-form');
  const titleInput = document.getElementById('title');
  const noteInput = document.getElementById('note');
  const dueInput = document.getElementById('due');
  const priorityInput = document.getElementById('task-priority');
  const genreInput = document.getElementById('task-genre');
  const statusFilter = document.getElementById('filter-status');
  const priorityFilter = document.getElementById('filter-priority');
  const genreFilter = document.getElementById('filter-genre');
  const listEl = document.getElementById('task-list');
  const editEl = document.getElementById('task-edit');
  const error = document.getElementById('error-message');
  const modal = document.getElementById('modal');
  const addButton = document.getElementById('add-button');
  const closeButton = document.getElementById('close-modal');

  // フォームが「新規追加モード」か「既存タスクの編集モード」かを判定する状態
  let editing = false;
  // 編集対象タスクの tasks 配列内インデックス（タスクにIDは無く、配列の位置がそのまま識別子）
  let editing_task_index = -1;

  // localStorageに保存する際のキー名。フォーマットを変える場合はバージョン番号を上げる想定
  const STORAGE_KEY = 'todoTasks_v1';
  // アプリの唯一のデータ本体。この配列を丸ごとJSON化してlocalStorageに保存/復元する
  let tasks = [];

  // 現在のtasks配列の内容をlocalStorageに書き込む（呼び忘れると変更が消える点に注意）
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  // ページ読み込み時にlocalStorageからtasks配列を復元する（保存データが無ければ空配列）
  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  }

  // タスク名をHTMLとして描画する際にXSS（スクリプト注入）を防ぐための簡易エスケープ
  function escapeHtml(s){
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }

  // ==========================
  // モーダル操作関数
  // ==========================

  function openModal(){
    modal.classList.remove('hidden');
  }

  function closeModal(){
    modal.classList.add('hidden');
  }

  // 1件のタスクを<li>要素として組み立てる。
  // idxはtasks配列内のインデックスで、チェックボックス/編集/削除ボタンに
  // dataset.indexとして埋め込み、イベント発火時にどのタスクか特定できるようにする
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

    const genre = document.createElement('div');
    genre.className = 'genre';
    genre.textContent = (task.genre || '');

    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = (task.note || '');

    info.appendChild(title);
    info.appendChild(note);
    info.appendChild(meta);
    left.appendChild(checkbox);
    left.appendChild(info);

    // 期限・優先度・ジャンルのうち値がある項目だけを「 • 」区切りで表示する
    meta.textContent = [task.due, task.priority, task.genre]
      .filter(Boolean)
      .join(' • ');

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

  // タスク一覧を現在のフィルター条件に従って再描画する。
  // DOMを毎回作り直すシンプルな方式のため、描画後に必ずattachListeners()でイベントを再登録する
  function render() {
    const status = statusFilter.value;
    const priority = priorityFilter.value
    const genre = genreFilter.value;

    listEl.innerHTML = '';

    tasks.forEach((t,i) => {
      // ステータスフィルター（すべて/未完了/完了）に合致しないタスクは表示しない
      if(status === 'active' && t.completed) return;
      if(status === 'completed' && !t.completed) return;

      // 優先度フィルターに合致しないタスクは表示しない
      if(priority !== 'all' && t.priority !== priority) return;

      // ジャンルフィルターに合致しないタスクは表示しない
      if(genre !== 'all' && t.genre !== genre) return;

      listEl.appendChild(createTaskElement(t,i));
    });

    attachListeners();
  }

  // render()で生成された最新のDOM要素に対して、完了チェック・削除・編集の
  // イベントを付け直す（render()のたびに要素が作り直されるため毎回呼ぶ必要がある）
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

    // 編集: フォームに既存タスクの値を流し込んでモーダルを開く。
    // 実際の保存はform.addEventListener('submit', ...)側でeditingフラグを見て行う
    listEl.querySelectorAll('.edit').forEach(btn => {
      btn.addEventListener('click', e => {
        editing = true;
        const i = Number(e.target.dataset.index);
        editing_task_index = i;
        const task = tasks[i];
        titleInput.value = task.title;
        noteInput.value = task.note || '';
        genreInput.value = task.genre || '';
        dueInput.value = task.due || '';
        priorityInput.value = task.priority || 'medium';
        openModal();
      });
    });
  }

  // ==========================
  // モーダルのイベント登録
  // ==========================

  // 「追加」ボタン: フォームを空の状態にリセットし、新規追加モードでモーダルを開く
  addButton.addEventListener('click', () => {
    form.reset();
    editing = false;
    editing_task_index = -1;
    error.textContent = '';
    titleInput.classList.remove('active');
    openModal();
  });

  // 「閉じる」ボタンでモーダルを閉じる
  closeButton.addEventListener('click', () => {
    closeModal();
  });

  // モーダルの背景（オーバーレイ）部分をクリックしたときだけ閉じる
  // （e.target === modal のチェックがないとモーダル内部のクリックでも閉じてしまう）
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
    // タスク名は必須項目。未入力ならエラー表示して送信を中断する
    if (!title) {
      error.textContent = 'タスク名を入力してください';
      titleInput.classList.add('active');
      return;
    }

    // フォームの入力値から新しいタスクオブジェクトを生成
    const task = {
      title,
      note,
      due: dueInput.value || null,
      priority: priorityInput.value || 'medium',
      genre: genreInput.value || '',
      completed: false
    };

    if (editing) {
      // 編集モード: 完了状態は元のタスクから引き継ぎ、該当インデックスのタスクを丸ごと差し替える
      task.completed = tasks[editing_task_index].completed;
      tasks[editing_task_index] = task;
      editing = false;
      editing_task_index = -1;
      save();
      render();
      form.reset();
      closeModal();
    } else {
      // 新規追加モード: 配列末尾に新しいタスクを追加する
      tasks.push(task);
      save();
      render();
      form.reset();
      closeModal();
    }
  });

  // フィルター（ステータス/優先度/ジャンル）が変更されたら一覧を再描画する
  statusFilter.addEventListener('change', render);
  priorityFilter.addEventListener('change', render);
  genreFilter.addEventListener('change', render);

  // ==========================
  // 初期化
  // ==========================
  // localStorageから既存タスクを読み込み → 一覧を描画 → モーダルは閉じた状態でスタート
  load();
  render();
  closeModal();
})();