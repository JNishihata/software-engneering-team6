# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A client-side ToDo management app built with plain HTML/CSS/JavaScript — no framework, no bundler, no package manager. All state lives in a single in-memory `tasks` array and is persisted to `localStorage`. There is nothing to install or build.

Files:
- `index.html` — page structure (task form, modal, filters, list container)
- `style.css` — styling
- `app.js` — all application logic, wrapped in a single IIFE

## Running / testing

There is no build step, dev server, linter, or test suite configured. To run the app, open `index.html` directly in a browser (or serve the directory with any static file server, e.g. `python3 -m http.server`, if `file://` localStorage restrictions cause issues). Verify changes manually in the browser — there are no automated tests to run.

## Architecture

Everything is implemented inside the single IIFE in `app.js`:

- **Data model**: a task is a plain object `{ title, note, due, priority, genre, completed }`. Tasks have no id field — a task's position in the `tasks` array is its identity, and is passed around as `idx` / `dataset.index` on DOM elements (checkbox, edit button, delete button).
- **Persistence**: `save()` serializes the whole `tasks` array to `localStorage` under `STORAGE_KEY` (`'todoTasks_v1'`); `load()` deserializes it back on startup. There is no incremental/partial persistence — any mutation to `tasks` must be followed by an explicit `save()` call or it will be lost on reload.
- **Render loop**: `render()` rebuilds the entire `<ul>` list from scratch based on the current filter dropdown values (status/priority/genre), then calls `attachListeners()` to rebind click/change handlers to the freshly created DOM elements. Because elements are recreated on every render, listeners must always be reattached after a render — there is no persistent event delegation.
- **Add vs. edit flow**: a single form (`#task-form`) inside a modal is shared for both creating and editing tasks, disambiguated by the `editing` / `editing_task_index` module-level flags. Clicking a task's "編集" button populates the form from `tasks[i]` and sets `editing = true`; the form's `submit` handler branches on `editing` to either overwrite `tasks[editing_task_index]` or push a new task, then in both branches calls `save()`, `render()`, `form.reset()`, and `closeModal()`.
- **Known gap**: `index.html` includes UI for adding a custom genre (`#new_genre`, `#newGenreArea`, `#newGenre`), but there is no corresponding logic in `app.js` — these inputs are not currently wired up.

## Repository layout

- `sourceCode/` — the app itself (this directory)
- `reports/` — course submission documents (requirements spec, notes), not part of the running app. Useually you don't need edit and refer this directory.
