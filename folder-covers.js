// Folder Covers for modern Spotify + Spicetify
// Hover a playlist-folder row in Your Library, then click the small image button.
// Images stay only on this computer in IndexedDB.

(async function FolderCovers() {
  if (!window.Spicetify) return;

  const DB_NAME = "folder-covers-by-05hrs";
  const STORE = "covers";
  const BUTTON_CLASS = "folder-covers-picker";

  const openDB = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  async function getCover(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveCover(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteCover(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function getAllCovers() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      const keys = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
      let values;
      request.onsuccess = () => { values = request.result; if (keys.readyState === 'done') resolve(keys.result.map((key, i) => [key, values[i]])); };
      keys.onsuccess = () => { if (values) resolve(keys.result.map((key, i) => [key, values[i]])); };
      request.onerror = keys.onerror = () => reject(request.error || keys.error);
    });
  }

  const coverImage = value => typeof value === 'string' ? value : value?.image;

  let activeFolderRow = null;
  const FOLDER_LAYER = '[aria-labelledby*="folder:"]';

  function getFolderRow(element) {
    const layers = element?.closest?.(FOLDER_LAYER)
      ? [element.closest(FOLDER_LAYER)]
      : document.elementsFromPoint?.(window.__folderCoverX || 0, window.__folderCoverY || 0)
          .map(item => item.closest?.(FOLDER_LAYER)).filter(Boolean) || [];
    // Spotify's clickable folder layer is empty; its parent is the actual
    // visible row containing the icon and label.
    return layers[0]?.parentElement || null;
  }

  function rowName(row) {
    const text = (row.innerText || "").trim();
    // Spotify sometimes joins the name and subtitle without a line break:
    // "DestroyLonely12 playlists". Remove that subtitle before saving.
    const withoutSubtitle = text.replace(/\d+\s+(?:folders?|playlists?)\s*$/i, "").trim();
    const lines = withoutSubtitle.split("\n").map(x => x.trim()).filter(Boolean);
    return lines[0] || "Playlist folder";
  }

  function coverKey(row) {
    const layer = row?.matches?.(FOLDER_LAYER) ? row : row?.querySelector?.(FOLDER_LAYER);
    const label = layer?.getAttribute('aria-labelledby') || '';
    const uri = label.split(/\s+/).find(part => part.includes(':folder:'));
    return uri ? `spotify-folder:${uri}` : null;
  }

  function applyImage(row, image) {
    const icon = row.querySelector('img, svg')?.parentElement;
    if (!icon || !image) return;
    icon.style.cssText += `;background-image:url("${image}");background-size:cover;background-position:center;border-radius:5px;overflow:hidden;`;
    const svg = icon.querySelector('svg');
    if (svg) svg.style.opacity = "0";
  }

  function showPreview(row, key, image) {
    document.querySelector('.folder-covers-preview-backdrop')?.remove();
    const backdrop = document.createElement('div');
    backdrop.className = 'folder-covers-preview-backdrop';
    backdrop.innerHTML = `
      <div class="folder-covers-preview" role="dialog" aria-modal="true">
        <div class="folder-covers-preview-title">Set folder cover</div>
        <img class="folder-covers-preview-image" alt="Folder cover preview">
        <div class="folder-covers-preview-name"></div>
        <div class="folder-covers-preview-actions">
          <button class="folder-covers-cancel">Cancel</button>
          <button class="folder-covers-save">Save cover</button>
        </div>
      </div>`;
    backdrop.querySelector('img').src = image;
    backdrop.querySelector('.folder-covers-preview-name').textContent = rowName(row);
    const close = () => backdrop.remove();
    backdrop.onclick = event => { if (event.target === backdrop) close(); };
    backdrop.querySelector('.folder-covers-cancel').onclick = close;
    backdrop.querySelector('.folder-covers-save').onclick = async () => {
      await saveCover(key, { image, name: rowName(row) });
      applyImage(row, image);
      close();
      Spicetify.showNotification(`Folder cover set for ${rowName(row)}`);
    };
    document.body.append(backdrop);
  }

  async function pickImage(row) {
    const key = coverKey(row);
    if (!key) {
      Spicetify.showNotification('Could not identify this Spotify folder', true);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 15 * 1024 * 1024) {
        Spicetify.showNotification("Use an image under 15 MB", true);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => showPreview(row, key, reader.result);
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function addButton(row) {
    // The context-menu option is the main way to set covers. This small button
    // remains as a fallback if Spotify changes or hides its menu markup.
    if (row.querySelector(`.${BUTTON_CLASS}`)) return;
    const key = coverKey(row);
    if (!key) return;
    const image = coverImage(await getCover(key));
    if (image) applyImage(row, image);

    row.style.position ||= "relative";
    const button = document.createElement("button");
    button.className = BUTTON_CLASS;
    button.title = `Set cover for ${rowName(row)}`;
    button.textContent = "▣";
    button.onclick = event => { event.preventDefault(); event.stopPropagation(); pickImage(row); };
    button.oncontextmenu = async event => {
      event.preventDefault(); event.stopPropagation();
      await deleteCover(key);
      location.reload();
    };
    row.append(button);
  }

  function addMenuOption(menu) {
    if (!activeFolderRow || menu.querySelector('.folder-covers-menu-item')) return;
    const text = (menu.innerText || '').toLowerCase();
    if (!text.includes('rename') || !text.includes('delete') || !text.includes('pin folder')) return;

    const reference = [...menu.querySelectorAll('button, [role="menuitem"]')]
      .find(item => /^rename$/i.test((item.innerText || '').trim()));
    if (!reference) return;

    const item = reference.cloneNode(true);
    item.classList.add('folder-covers-menu-item');
    item.removeAttribute('aria-disabled');
    const label = item.querySelector('span:last-child') || item;
    label.textContent = 'Set folder cover';
    const svg = item.querySelector('svg');
    if (svg) svg.innerHTML = '<path d="M3 5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm3 3v7h12V8H6Zm2 2h8v3H8v-3Z"></path>';
    item.onclick = event => {
      event.preventDefault(); event.stopPropagation();
      pickImage(activeFolderRow);
      menu.remove();
    };
    reference.insertAdjacentElement('afterend', item);
  }

  function addProfileOption(menu) {
    if (menu.querySelector('.folder-covers-profile-item')) return;
    const text = (menu.innerText || '');
    if (!text.includes('Account') || !text.includes('Profile') || !text.includes('Log out')) return;
    const reference = [...menu.querySelectorAll('button, [role="menuitem"]')]
      .find(item => /^settings$/i.test((item.innerText || '').trim()))
      || [...menu.querySelectorAll('button, [role="menuitem"]')].find(item => /home config/i.test(item.innerText || ''));
    if (!reference) return;
    const item = reference.cloneNode(true);
    item.classList.add('folder-covers-profile-item');
    const label = item.querySelector('span:last-child') || item;
    label.textContent = 'Folder Covers';
    const svg = item.querySelector('svg');
    if (svg) svg.innerHTML = '<path d="M3 5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2V5Zm3 4v8h12V9H6Zm2 2h8v4H8v-4Z"></path>';
    item.onclick = event => { event.preventDefault(); event.stopPropagation(); menu.remove(); openSettings(); };
    reference.insertAdjacentElement('afterend', item);
  }

  function downloadBackup(items) {
    const blob = new Blob([JSON.stringify({ version: 1, covers: items }, null, 2)], { type: 'application/json' });
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'folder-covers-backup.json' });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function importBackup(file, refresh) {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.covers)) throw new Error();
      for (const [key, value] of data.covers) await saveCover(key, value);
      Spicetify.showNotification(`Imported ${data.covers.length} folder covers`);
      refresh();
    } catch { Spicetify.showNotification('That is not a valid Folder Covers backup', true); }
  }

  async function openSettings() {
    document.querySelector('.folder-covers-settings-backdrop')?.remove();
    const backdrop = document.createElement('div');
    backdrop.className = 'folder-covers-settings-backdrop';
    backdrop.innerHTML = `<div class="folder-covers-settings" role="dialog" aria-modal="true">
      <div class="folder-covers-settings-header"><div><div class="folder-covers-settings-title">Folder Covers</div><div class="folder-covers-settings-subtitle">Your saved folder artwork</div></div><button class="folder-covers-close" aria-label="Close">×</button></div>
      <div class="folder-covers-settings-tools"><button class="folder-covers-export">Export covers</button><button class="folder-covers-import">Import covers</button><input class="folder-covers-import-input" type="file" accept="application/json" hidden></div>
      <div class="folder-covers-gallery"></div>
    </div>`;
    const gallery = backdrop.querySelector('.folder-covers-gallery');
    const refresh = async () => {
      const items = await getAllCovers();
      gallery.innerHTML = items.length ? '' : '<div class="folder-covers-empty">No covers saved yet. Right-click a folder to add one.</div>';
      for (const [key, value] of items) {
        const image = coverImage(value);
        if (!image) continue;
        const name = typeof value === 'object' && value.name ? value.name : 'Saved folder';
        const card = document.createElement('div');
        card.className = 'folder-covers-card';
        card.innerHTML = `<img alt=""><div class="folder-covers-card-name"></div><button>Remove</button>`;
        card.querySelector('img').src = image;
        card.querySelector('.folder-covers-card-name').textContent = name;
        card.querySelector('button').onclick = async () => { await deleteCover(key); refresh(); scan(); };
        gallery.append(card);
      }
    };
    backdrop.querySelector('.folder-covers-close').onclick = () => backdrop.remove();
    backdrop.onclick = event => { if (event.target === backdrop) backdrop.remove(); };
    backdrop.querySelector('.folder-covers-export').onclick = async () => downloadBackup(await getAllCovers());
    const input = backdrop.querySelector('.folder-covers-import-input');
    backdrop.querySelector('.folder-covers-import').onclick = () => input.click();
    input.onchange = () => input.files?.[0] && importBackup(input.files[0], refresh);
    document.body.append(backdrop);
    refresh();
  }

  function scan() {
    for (const layer of document.querySelectorAll(FOLDER_LAYER)) {
      const row = layer.parentElement;
      if (row) addButton(row).catch(console.error);
    }
    document.querySelectorAll('[role="menu"], [data-encore-id="contextMenu"]').forEach(menu => { addMenuOption(menu); addProfileOption(menu); });
  }

  const style = document.createElement("style");
  style.textContent = `
    .${BUTTON_CLASS} { position:absolute; right:8px; top:50%; transform:translateY(-50%); z-index:5; width:25px; height:25px; border:0; border-radius:50%; background:#242424; color:#fff; display:none; cursor:pointer; font-size:14px; line-height:25px; padding:0; }
    button:hover > .${BUTTON_CLASS}, [role="button"]:hover > .${BUTTON_CLASS}, li:hover > .${BUTTON_CLASS}, div:hover > .${BUTTON_CLASS} { display:block; }
    .${BUTTON_CLASS}:hover { background:#3d3d3d; transform:translateY(-50%) scale(1.08); }
    .folder-covers-preview-backdrop { position:fixed; inset:0; z-index:99999; display:grid; place-items:center; background:rgba(0,0,0,.65); }
    .folder-covers-preview { width:330px; padding:24px; border-radius:12px; background:#242424; color:#fff; box-shadow:0 18px 70px rgba(0,0,0,.55); font-family:inherit; }
    .folder-covers-preview-title { font-size:19px; font-weight:700; margin-bottom:17px; }
    .folder-covers-preview-image { width:100%; aspect-ratio:1; display:block; object-fit:cover; border-radius:8px; background:#181818; }
    .folder-covers-preview-name { padding-top:12px; color:#b3b3b3; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .folder-covers-preview-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:22px; }
    .folder-covers-preview-actions button { border:0; border-radius:999px; padding:9px 17px; font-weight:700; cursor:pointer; }
    .folder-covers-cancel { background:transparent; color:#fff; }
    .folder-covers-save { background:#1ed760; color:#000; }
    .folder-covers-settings-backdrop { position:fixed; inset:0; z-index:99999; display:grid; place-items:center; background:rgba(0,0,0,.65); }
    .folder-covers-settings { width:min(760px,calc(100vw - 40px)); max-height:80vh; overflow:auto; box-sizing:border-box; padding:24px; border-radius:12px; background:#242424; color:#fff; font-family:inherit; }
    .folder-covers-settings-header { display:flex; justify-content:space-between; align-items:start; margin-bottom:20px; }.folder-covers-settings-title { font-size:24px; font-weight:700; }.folder-covers-settings-subtitle { color:#b3b3b3; margin-top:4px; font-size:14px; }.folder-covers-close { border:0; border-radius:50%; width:32px; height:32px; background:#383838; color:#fff; font-size:23px; cursor:pointer; }
    .folder-covers-settings-tools { display:flex; gap:10px; margin-bottom:22px; }.folder-covers-settings-tools button,.folder-covers-card button { border:0; border-radius:999px; padding:9px 14px; background:#383838; color:#fff; font-weight:700; cursor:pointer; }.folder-covers-settings-tools button:first-child { background:#1ed760; color:#000; }
    .folder-covers-gallery { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:16px; }.folder-covers-card { min-width:0; }.folder-covers-card img { width:100%; aspect-ratio:1; display:block; object-fit:cover; border-radius:8px; background:#181818; }.folder-covers-card-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:700; padding:9px 0; }.folder-covers-card button { width:100%; font-size:12px; background:#4b2222; }.folder-covers-empty { color:#b3b3b3; grid-column:1/-1; padding:32px 0; text-align:center; }
  `;
  document.head.append(style);

  document.addEventListener('contextmenu', event => {
    window.__folderCoverX = event.clientX;
    window.__folderCoverY = event.clientY;
    const row = getFolderRow(event.target);
    if (row) activeFolderRow = row;
  }, true);

  const observer = new MutationObserver(() => scan());
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(scan, 1500);
})();
