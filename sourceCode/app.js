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
  const priorityFilter = document.getElementById('filter-priority');
  const genreFilter = document.getElementById('filter-genre');
  const listEl = document.getElementById('task-list');
  const editEl = document.getElementById('task-edit');
  const error = document.getElementById('error-message');
  const taskAddModal = document.getElementById('task-add-modal');
  const genreEditModal = document.getElementById('genre-edit-modal');
  const addButton = document.getElementById('add-button');
  const showGenreEditModalButton = document.getElementById('show-genre-edit-modal-button');
  const closeTaskAddModalButton = document.getElementById('close-task-add-modal');
  const closeGenreEditModalButton = document.getElementById('close-genre-edit-modal');
  const newGenreArea = document.getElementById('newGenreArea');
  const newGenreInput = document.getElementById('newGenre');
  const addGenreButton = document.getElementById('add-genre-button');
  const menuButton = document.getElementById('menu-button');
  const menuDropdown = document.getElementById('menu-dropdown');
  const genreManageList = document.getElementById('genre-manage-list');

  const taskModalTitle = document.getElementById('task-modal-title');
  const taskSubmitButton = document.getElementById('task-submit-button');

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

  // ジャンル一覧を保存するキー。tasksとは別に、ユーザーが追加したジャンルだけを管理する
  const GENRES_STORAGE_KEY = 'todoGenres_v1';
  // ジャンルは { id, name } のオブジェクト配列で管理する
  let genres = [];

  // 現在のtasks配列の内容をlocalStorageに書き込む（呼び忘れると変更が消える点に注意）
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  // genres配列の内容をlocalStorageに書き込む
  function saveGenres() {
    localStorage.setItem(GENRES_STORAGE_KEY, JSON.stringify(genres));
  }

  // ジャンルIDから表示名を取得する
  function getGenreName(id) {
    const genre = genres.find(g => g.id === Number(id));
    return genre ? genre.name : '';
  }

  // 既存のlocalStorageデータ（文字列ジャンル）をID管理へ移行する
  function migrateTasksIfNeeded() {
    let changed = false;

    tasks.forEach(task => {
      if (typeof task.genre === 'string') {
        const genreName = task.genre.trim();

        if (genreName) {
          let genre = genres.find(g => g.name === genreName);

          if (!genre) {
            const nextId =
              genres.length === 0
                ? 1
                : Math.max(...genres.map(g => g.id)) + 1;

            genre = {
              id: nextId,
              name: genreName
            };

            genres.push(genre);
          }

          task.genre = genre.id;
        } else {
          task.genre = null;
        }

        changed = true;
      }
    });

    if (changed) {
      saveGenres();
      save();
    }
  }

  // ページ読み込み時にlocalStorageからtasks配列を復元する（保存データが無ければ空配列）
  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];

    // genresを先に読み込んだ後に呼ばれる前提で、既存データをID管理へ移行する
    migrateTasksIfNeeded();
  }

  // 保存データが無い場合は初期ジャンルとして「課題」を1つ用意する
  function loadGenres() {
    const raw = localStorage.getItem(GENRES_STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        genres = parsed;
      } else if (Array.isArray(parsed)) {
        // 旧データ（文字列配列）を { id, name } 形式へ変換する
        genres = parsed.map((name, index) => ({
          id: index + 1,
          name: name
        }));

        saveGenres();
      } else {
        genres = [
          {
            id: 1,
            name: '課題'
          }
        ];

        saveGenres();
      }
    } else {
      genres = [
        {
          id: 1,
          name: '課題'
        }
      ];

      saveGenres();
    }
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
      opt.value = String(g.id);
      opt.textContent = g.name;
      genreFilter.appendChild(opt);
    });

    genreFilter.value = genres.some(g => String(g.id) === currentFilterValue)
      ? currentFilterValue
      : 'all';

    const currentTaskGenreValue = genreInput.value;

    genreInput.innerHTML = '';
    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = '未設定';
    genreInput.appendChild(noneOption);

    genres.forEach(g => {
      const opt = document.createElement('option');
      opt.value = String(g.id);
      opt.textContent = g.name;
      genreInput.appendChild(opt);
    });

    const newOption = document.createElement('option');
    newOption.value = NEW_GENRE_OPTION_VALUE;
    newOption.textContent = '新規作成';
    genreInput.appendChild(newOption);

    if (genres.some(g => String(g.id) === currentTaskGenreValue)) {
      genreInput.value = currentTaskGenreValue;
    }
  }
    // ヘッダーの「・・・」メニュー内、ジャンル管理一覧を描画する。
  // 各ジャンルに編集・削除ボタンを添え、クリックでジャンルを管理する
  function renderGenreManageList() {
    genreManageList.innerHTML = '';

    if (genres.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'genre-empty';
      empty.textContent = 'ジャンルがありません';
      genreManageList.appendChild(empty);
      return;
    }

    genres.forEach((genre, i) => {

      const li = document.createElement('li');

      const name = document.createElement('span');
      name.textContent = genre.name;

      const buttonArea = document.createElement('div');

      // ----------------------------
      // 編集ボタン
      // ----------------------------
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'genre-edit';
      edit.textContent = '編集';

      edit.addEventListener('click', () => {

        const newName = prompt(
          '新しいジャンル名を入力してください',
          genre.name
        );

        if (newName === null) return;

        const trimmed = newName.trim();

        if (!trimmed) {
          alert('ジャンル名を入力してください');
          return;
        }

        // 同名ジャンル禁止
        if (
          genres.some(g =>
            g.id !== genre.id &&
            g.name === trimmed
          )
        ) {
          alert('同じジャンル名が既に存在します');
          return;
        }

        // IDはそのまま、名前だけ変更
        genre.name = trimmed;

        saveGenres();
        refreshGenreUI();
        render();

      });

      // ----------------------------
      // 削除ボタン
      // ----------------------------
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'genre-delete';
      del.textContent = '×';

      del.addEventListener('click', () => {

        const using = tasks.some(
          task => task.genre === genre.id
        );

        if (using) {

          if (
            !confirm(
              `「${genre.name}」を使用しているタスクがあります。\n削除するとジャンル未設定になります。\n削除しますか？`
            )
          ) {
            return;
          }

          tasks.forEach(task => {
            if (task.genre === genre.id) {
              task.genre = null;
            }
          });

          save();

        } else {

          if (
            !confirm(
              `「${genre.name}」を削除しますか？`
            )
          ) {
            return;
          }

        }

        genres.splice(i, 1);

        saveGenres();
        refreshGenreUI();
        render();

      });

      buttonArea.appendChild(edit);
      buttonArea.appendChild(del);

      li.appendChild(name);
      li.appendChild(buttonArea);

      genreManageList.appendChild(li);

    });

  }

  // ジャンル一覧に変更があった際に、
  // フォーム/フィルターの選択肢とメニューの管理一覧を両方更新する
  function refreshGenreUI() {
    renderGenreOptions();
    renderGenreManageList();
  }

  // genres一覧に無ければ追加して保存し、
  // 追加したジャンルのIDを返す
  function addGenreIfNew(name) {

    const found = genres.find(g => g.name === name);

    if (found) {
      return found.id;
    }

    const nextId =
      genres.length === 0
        ? 1
        : Math.max(...genres.map(g => g.id)) + 1;

    genres.push({
      id: nextId,
      name: name
    });

    saveGenres();
    refreshGenreUI();

    return nextId;

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

    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = task.note || '';

    const meta = document.createElement('div');
    meta.className = 'meta';

    let priority_show = '';

    switch (task.priority) {

      case 'low':
        priority_show = '低';
        break;

      case 'medium':
        priority_show = '中';
        break;

      case 'high':
        priority_show = '高';
        break;

      default:
        priority_show = '';
        break;
    }

    // ジャンルIDから表示名へ変換
    const genreName = getGenreName(task.genre);

    // 期限・優先度・ジャンルを表示
    meta.textContent = [
      task.due,
      priority_show,
      genreName
    ]
      .filter(Boolean)
      .join(' • ');

    info.appendChild(title);
    info.appendChild(note);
    info.appendChild(meta);

    left.appendChild(checkbox);
    left.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const edit = document.createElement('button');
    edit.className = 'edit';
    edit.dataset.index = idx;
    edit.textContent = '編集';

    const del = document.createElement('button');
    del.className = 'delete';
    del.dataset.index = idx;
    del.textContent = '削除';

    actions.appendChild(edit);
    actions.appendChild(del);

    li.appendChild(left);
    li.appendChild(actions);

    return li;

  }
    // タスク一覧を現在のフィルター条件に従って再描画する。
  function render() {

    const priority = priorityFilter.value;
    const genre = genreFilter.value;

    listEl.innerHTML = '';

    tasks.forEach((t, i) => {

      // 「完了済みタスクを表示」のチェックボックスを押すと完了も表示される
      if (!showCompleted.checked && t.completed) return;



      // 優先度
      if (priority !== 'all' && t.priority !== priority) return;

      // ジャンル(ID比較)
      if (
        genre !== 'all' &&
        String(t.genre) !== genre
      ) {
        return;
      }

      listEl.appendChild(createTaskElement(t, i));

    });

    attachListeners();

  }

  // render()で生成された最新のDOM要素にイベントを付与する
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

        taskModalTitle.textContent = 'タスク編集';
        taskSubmitButton.textContent = '保存';

        const i = Number(e.target.dataset.index);

        editing_task_index = i;

        const task = tasks[i];

        titleInput.value = task.title;
        noteInput.value = task.note || '';
        dueInput.value = task.due || '';
        priorityInput.value = task.priority || 'medium';

        newGenreArea.classList.add('hidden');

        // ジャンルIDをselectへセット
        genreInput.value =
          task.genre != null
            ? String(task.genre)
            : '';

        taskAddModal.classList.remove('hidden');

      });

    });

  }
    // ==========================
  // モーダルのイベント登録
  // ==========================

  // 「追加」ボタン
  addButton.addEventListener('click', () => {

    form.reset();

    editing = false;
    editing_task_index = -1;

    taskModalTitle.textContent = 'タスク追加';
    taskSubmitButton.textContent = '追加';

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
  // ヘッダーメニュー
  // ==========================

  menuButton.addEventListener('click', e => {

    e.stopPropagation();

    menuDropdown.classList.toggle('hidden');

  });

  document.addEventListener('click', e => {

    if (
      !menuDropdown.classList.contains('hidden') &&
      !e.target.closest('.menu-wrapper')
    ) {
      menuDropdown.classList.add('hidden');
    }

  });

  // ==========================
  // ジャンル追加
  // ==========================

  genreInput.addEventListener('change', () => {

    if (genreInput.value === NEW_GENRE_OPTION_VALUE) {

      newGenreArea.classList.remove('hidden');
      newGenreInput.focus();

    } else {

      newGenreArea.classList.add('hidden');

    }

  });

  addGenreButton.addEventListener('click', () => {

    const newGenre = newGenreInput.value.trim();

    if (!newGenre) {
      newGenreInput.value = '';
      return;
    }

    // IDを取得
    const id = addGenreIfNew(newGenre);

    // selectは文字列なのでString()
    genreInput.value = String(id);

    newGenreInput.value = '';
    newGenreArea.classList.add('hidden');

  });

  // ==========================
  // モーダルを閉じる
  // ==========================

  closeTaskAddModalButton.addEventListener('click', () => {
    
    editing = false;
    editing_task_index = -1;

    taskModalTitle.textContent = 'タスク追加';
    taskSubmitButton.textContent = '追加';

    taskAddModal.classList.add('hidden');

  });

  closeGenreEditModalButton.addEventListener('click', () => {

    genreEditModal.classList.add('hidden');

  });

  taskAddModal.addEventListener('click', e => {

    if (e.target === taskAddModal) {

        editing = false;
        editing_task_index = -1;

        taskModalTitle.textContent = 'タスク追加';
        taskSubmitButton.textContent = '追加';

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
  // タスク追加・編集保存
  // ==========================

  form.addEventListener('submit', e => {

    e.preventDefault();

    const title = titleInput.value.trim();

    if (!title) {

      error.textContent = 'タスク名を入力してください';
      titleInput.classList.add('active');

      return;

    }


    // --------------------------
    // 新規ジャンル処理
    // --------------------------

    if (
      genreInput.value === NEW_GENRE_OPTION_VALUE
    ) {

      const newGenre =
        newGenreInput.value.trim();


      if (!newGenre) {

        error.textContent =
          'ジャンル名を入力してください';

        return;

      }


      const id =
        addGenreIfNew(newGenre);


      genreInput.value =
        String(id);


      newGenreInput.value = '';

      newGenreArea.classList.add('hidden');

    }


    const task = {

      title,

      note:
        noteInput.value.trim(),

      due:
        dueInput.value || null,

      priority:
        priorityInput.value || 'medium',

      genre:
        genreInput.value
          ? Number(genreInput.value)
          : null,

      completed:false

    };


    // 編集の場合
    if(editing){

      task.completed =
        tasks[editing_task_index].completed;


      tasks[editing_task_index] =
        task;


    }
    else{

      tasks.push(task);

    }


    save();

    render();

    form.reset();

    editing=false;

    editing_task_index=-1;

    taskModalTitle.textContent = 'タスク追加';
    taskSubmitButton.textContent = '追加';

    taskAddModal.classList.add('hidden');

  });

  // フィルター（ステータス/優先度/ジャンル）が変更されたら一覧を再描画する
  priorityFilter.addEventListener('change', render);
  genreFilter.addEventListener('change', render);
  showCompleted.addEventListener('change', render);

  // ==========================
  // 初期化
  // ==========================

  loadGenres();

  load();

  refreshGenreUI();

  render();


  taskAddModal.classList.add('hidden');

  genreEditModal.classList.add('hidden');


})();