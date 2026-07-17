// To do App's main logic file. localStorageへの永続化とタスクの一覧表示・追加・編集・削除・フィルタリングを担う。
// グローバルスコープを汚さないよう即時実行関数（IIFE）で全体を包んでいる。
(() => {
  // Get elements in index.html
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
  const taskAddModal = document.getElementById('task-add-modal');
  const genreEditModal = document.getElementById('genre-edit-modal');
  const addButton = document.getElementById('add-button');
  const showGenreEditModalButton = document.getElementById('show-genre-edit-modal-button')
  const closeTaskAddModalButton = document.getElementById('close-task-add-modal');
  const closeGenreEditModalButton = document.getElementById('close-genre-edit-modal');
  const newGenreArea = document.getElementById('newGenreArea');
  const newGenreInput = document.getElementById('newGenre');
  const addGenreButton = document.getElementById('add-genre-button');
  const menuButton = document.getElementById('menu-button');
  const menuDropdown = document.getElementById('menu-dropdown');
  const genreManageList = document.getElementById('genre-manage-list');
  const showCompleted = document.getElementById('show-completed');

  // ジャンルの新規作成を選ぶ際に使う特別な値（実際のジャンル名とは絶対に衝突しない前提の予約値）
  const NEW_GENRE_OPTION_VALUE = '__new__';

  // Flag of editing mode
  let editing = false;
  // Index of editing task (Order of task)
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

  // ジャンル一覧を保存するキー。tasksとは別に、ユーザーが追加したジャンル名だけを管理する
  const GENRES_STORAGE_KEY = 'todoGenres_v1';
  // 選択肢として表示するジャンル名の一覧（タスクで使われているかどうかに関わらず保持する）
  let genres = [];

  function saveGenres() {
    localStorage.setItem(GENRES_STORAGE_KEY, JSON.stringify(genres));
  }

  // 保存データが無い場合は初期ジャンルとして「課題」を1つ用意する
  function loadGenres() {
    const raw = localStorage.getItem(GENRES_STORAGE_KEY);
    genres = raw ? JSON.parse(raw) : ['課題'];
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


  // ジャンル一覧（genres配列）の内容に合わせて、フィルター用セレクトとフォーム用セレクトの
  // <option>を作り直す。ジャンルの追加・削除があるたびに呼び出す
  function renderGenreOptions() {
    const currentFilterValue = genreFilter.value || 'all';
    genreFilter.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'すべて';
    genreFilter.appendChild(allOption);
    genres.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      genreFilter.appendChild(opt);
    });
    genreFilter.value = genres.includes(currentFilterValue) ? currentFilterValue : 'all';

    const currentTaskGenreValue = genreInput.value;
    genreInput.innerHTML = '';
    genres.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      genreInput.appendChild(opt);
    });
    const newOption = document.createElement('option');
    newOption.value = NEW_GENRE_OPTION_VALUE;
    newOption.textContent = '新規作成';
    genreInput.appendChild(newOption);
    if (genres.includes(currentTaskGenreValue)) {
      genreInput.value = currentTaskGenreValue;
    }
  }

  // ヘッダーの「・・・」メニュー内、ジャンル管理一覧を描画する。
  // 各ジャンルに削除ボタンを添え、クリックでgenres配列から取り除く
  function renderGenreManageList() {
    genreManageList.innerHTML = '';

    if (genres.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'genre-empty';
      empty.textContent = 'ジャンルがありません';
      genreManageList.appendChild(empty);
      return;
    }

    genres.forEach((g, i) => {
      const li = document.createElement('li');

      const name = document.createElement('span');
      name.textContent = g;

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'genre-delete';
      del.dataset.index = i;
      del.textContent = '×';
      del.addEventListener('click', () => {
        genres.splice(i, 1);
        saveGenres();
        refreshGenreUI();
      });

      li.appendChild(name);
      li.appendChild(del);
      genreManageList.appendChild(li);
    });
  }

  // ジャンル一覧に変更があった際に、フォーム/フィルターの選択肢とメニューの管理一覧を両方更新する
  function refreshGenreUI() {
    renderGenreOptions();
    renderGenreManageList();
  }

  // genres一覧に無ければ追加して保存し、選択肢を再描画する
  function addGenreIfNew(name) {
    if (!genres.includes(name)) {
      genres.push(name);
      saveGenres();
      refreshGenreUI();
    }
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

    let priority_show = "";

    switch (task.priority) {
      case "low":
      priority_show = "低";
      break;

    case "medium":
      priority_show = "中";
      break;

    case "high":
      priority_show = "高";
      break;
      
      default:
        priority_show = "";
        break;
    }



    // 期限・優先度・ジャンルのうち値がある項目だけを「 • 」区切りで表示する
    meta.textContent = [task.due, priority_show, task.genre]
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

      // 「完了済みタスクを表示」のチェックボックスを押すと完了も表示される
      if (!showCompleted.checked && t.completed) return;
      if(status === 'active' && t.completed) return;
      // if(status === 'completed' && !t.completed) return;

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
        newGenreArea.classList.add('hidden');
        genreInput.value = task.genre || '';
        dueInput.value = task.due || '';
        priorityInput.value = task.priority || 'medium';
        taskAddModal.classList.remove('hidden');
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
    newGenreArea.classList.add('hidden');
    taskAddModal.classList.remove('hidden');
    if (genreInput.value === NEW_GENRE_OPTION_VALUE) {
      newGenreArea.classList.remove('hidden');
      newGenreInput.focus();
    } else {
      newGenreArea.classList.add('hidden');
    }
  });

  showGenreEditModalButton.addEventListener('click', () => {
    genreEditModal.classList.remove('hidden');
  });

  // ==========================
  // ヘッダーメニュー（・・・ボタン）のイベント登録
  // ==========================

  // 「・・・」ボタンでドロップダウンの開閉をトグルする
  menuButton.addEventListener('click', e => {
    e.stopPropagation();
    menuDropdown.classList.toggle('hidden');
  });

  // メニューの外側をクリックしたら閉じる
  document.addEventListener('click', e => {
    if (!menuDropdown.classList.contains('hidden') && !e.target.closest('.menu-wrapper')) {
      menuDropdown.classList.add('hidden');
    }
  });

  // ==========================
  // ジャンル追加まわりのイベント登録
  // ==========================

  // ジャンルのセレクトで「新規作成」を選んだときだけ、ジャンル名入力欄を表示する
  genreInput.addEventListener('change', () => {
    if (genreInput.value === NEW_GENRE_OPTION_VALUE) {
      newGenreArea.classList.remove('hidden');
      newGenreInput.focus();
    } else {
      newGenreArea.classList.add('hidden');
    }
  });

  // 「追加」ボタン: 入力されたジャンル名をgenres一覧に追加し、選択肢を再描画したうえで
  // 追加したジャンルをそのままタスクのジャンルとして選択状態にする
  addGenreButton.addEventListener('click', () => {
    const newGenre = newGenreInput.value.trim();
    if (!newGenre) {
      newGenreInput.value = '';
      return;
    }
    addGenreIfNew(newGenre);
    genreInput.value = newGenre;
    newGenreInput.value = '';
    newGenreArea.classList.add('hidden');
  });

  // 「閉じる」ボタンでモーダルを閉じる
  closeTaskAddModalButton.addEventListener('click', () => {
    taskAddModal.classList.add('hidden');
  });

  closeGenreEditModalButton.addEventListener('click', () => {
    genreEditModal.classList.add('hidden');
  });

  // モーダルの背景（オーバーレイ）部分をクリックしたときだけ閉じる
  // （e.target === 各モーダル要素 のチェックがないとモーダル内部のクリックでも閉じてしまう）
  taskAddModal.addEventListener('click', e => {
    if (e.target === taskAddModal) {
      taskAddModal.classList.add('hidden');
    }
  });

  genreEditModal.addEventListener('click', e => {
    if (e.target === genreEditModal) {
      genreEditModal.classList.add('hidden');
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

    // ジャンルが「新規作成」のまま追加ボタンを押さずに送信された場合は、
    // 入力欄の内容をここでジャンルとして確定する
    if (genreInput.value === NEW_GENRE_OPTION_VALUE) {
      const newGenre = newGenreInput.value.trim();
      if (!newGenre) {
        error.textContent = 'ジャンル名を入力するか、既存のジャンルを選択してください';
        return;
      }
      addGenreIfNew(newGenre);
      genreInput.value = newGenre;
      newGenreInput.value = '';
      newGenreArea.classList.add('hidden');
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
      taskAddModal.classList.add('hidden');
    } else {
      // 新規追加モード: 配列末尾に新しいタスクを追加する
      tasks.push(task);
      save();
      render();
      form.reset();
      taskAddModal.classList.add('hidden');
    }
  });

  // フィルター（ステータス/優先度/ジャンル）が変更されたら一覧を再描画する
  statusFilter.addEventListener('change', render);
  priorityFilter.addEventListener('change', render);
  genreFilter.addEventListener('change', render);
  showCompleted.addEventListener('change', render);

  // ==========================
  // 初期化
  // ==========================
  // localStorageからジャンル一覧・既存タスクを読み込み → 選択肢とタスク一覧を描画 → モーダルは閉じた状態でスタート
  loadGenres();
  refreshGenreUI();
  load();
  render();
  taskAddModal.classList.add('hidden');
  genreEditModal.classList.add('hidden');
})();