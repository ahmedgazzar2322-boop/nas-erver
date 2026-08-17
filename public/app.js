'use strict';

let currentDrive = 'nas_main';
let currentPath = '';
let isReadOnly = false;
let cachedFiles = [];

function $(id) {
  return document.getElementById(id);
}

function getHostUrl() {
  const host = $('nas-target-host')?.value?.trim();
  if (host) return host.replace(/\/$/, '');
  return window.location.port ? window.location.origin : 'http://192.168.1.12:3000';
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function loadDrives() {
  const host = getHostUrl();
  const listEl = $('drives-list');

  try {
    const res = await fetch('/api/nas/drives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ piServerUrl: host })
    }).then(r => r.json()).catch(() => null);

    let drives = res?.drives || res || [];
    if (!Array.isArray(drives) || !drives.length) {
      // Fallback direct request
      const direct = await fetch(`${host}/api/nas/drives`).then(r => r.json()).catch(() => null);
      drives = direct?.drives || direct || [];
    }

    if (Array.isArray(drives) && drives.length) {
      listEl.innerHTML = drives.map((d, i) => {
        const isRo = !!d.isReadOnly;
        const isAct = d.letter?.toLowerCase() === currentDrive.toLowerCase() || (i === 0 && !currentDrive);
        return `
          <div class="drive-item ${isAct ? 'active' : ''}" data-letter="${d.letter}" data-ro="${isRo}" data-name="${d.name}">
            <div class="drive-icon ${isRo ? 'ro' : 'rw'}">
              <i class="fa-solid ${isRo ? 'fa-shield-halved' : 'fa-hard-drive'}"></i>
            </div>
            <div class="drive-details">
              <div class="drive-name">${d.name || d.letter}</div>
              <div class="drive-sub">${d.totalGB || 32} GB • ${isRo ? '🔒 Read-Only' : '⚡ Read / Write'}</div>
            </div>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.drive-item').forEach((el) => {
        el.addEventListener('click', () => {
          listEl.querySelectorAll('.drive-item').forEach(x => x.classList.remove('active'));
          el.classList.add('active');
          currentDrive = el.dataset.letter;
          isReadOnly = el.dataset.ro === 'true';
          currentPath = '';

          $('active-drive-title').textContent = el.dataset.name;
          const badge = $('active-perm-badge');
          if (isReadOnly) {
            badge.textContent = '🔒 READ-ONLY';
            badge.classList.add('ro-mode');
            $('btn-create-folder').style.display = 'none';
            $('btn-upload-label').style.display = 'none';
          } else {
            badge.textContent = '⚡ READ / WRITE';
            badge.classList.remove('ro-mode');
            $('btn-create-folder').style.display = 'flex';
            $('btn-upload-label').style.display = 'flex';
          }

          loadFiles();
        });
      });
    }
  } catch (err) {
    console.error('Error loading drives:', err);
  }
}

async function loadFiles() {
  const grid = $('file-grid');
  const host = getHostUrl();
  grid.innerHTML = '<div class="notice-box"><i class="fa-solid fa-spinner fa-spin"></i> Reading storage partition...</div>';

  try {
    const res = await fetch('/api/nas/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ piServerUrl: host, folderPath: currentPath })
    }).then(r => r.json()).catch(() => null);

    let items = res?.items || res?.files || [];
    if (!Array.isArray(items)) {
      const direct = await fetch(`${host}/api/nas/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: currentPath })
      }).then(r => r.json()).catch(() => null);
      items = direct?.items || direct?.files || [];
    }

    cachedFiles = items;
    renderFileGrid(items);
    $('stat-files-count').textContent = items.length;
  } catch (err) {
    grid.innerHTML = `<div class="notice-box">Failed to load files: ${err.message}</div>`;
  }
}

function renderFileGrid(items) {
  const grid = $('file-grid');
  if (!items || !items.length) {
    grid.innerHTML = '<div class="notice-box" style="grid-column: 1/-1; text-align:center; padding:30px;"><i class="fa-solid fa-box-open" style="font-size:32px; margin-bottom:10px; color:var(--text-dim);"></i><br>This directory is empty.</div>';
    return;
  }

  grid.innerHTML = items.map((f) => {
    const isDir = !!f.isDirectory;
    let iconClass = 'fa-file generic';
    if (isDir) iconClass = 'fa-folder folder';
    else if (f.name.endsWith('.pdf')) iconClass = 'fa-file-pdf pdf';
    else if (f.name.endsWith('.xlsx') || f.name.endsWith('.csv')) iconClass = 'fa-file-excel excel';
    else if (f.name.endsWith('.js') || f.name.endsWith('.json') || f.name.endsWith('.py')) iconClass = 'fa-file-code code';
    else if (f.name.match(/\.(mp4|mkv|mp3|wav|png|jpg)$/i)) iconClass = 'fa-file-video media';

    return `
      <div class="file-card" data-name="${f.name}" data-isdir="${isDir}">
        <i class="fa-solid ${iconClass} file-icon"></i>
        <div class="file-name" title="${f.name}">${f.name}</div>
        <div class="file-meta">${isDir ? 'Folder' : formatBytes(f.sizeBytes || f.size)}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.file-card').forEach((card) => {
    card.addEventListener('click', () => {
      const name = card.dataset.name;
      const isDir = card.dataset.isdir === 'true';
      if (isDir) {
        currentPath = currentPath ? `${currentPath}/${name}` : name;
        updateBreadcrumbs();
        loadFiles();
      } else {
        // Direct download
        const host = getHostUrl();
        const sub = currentPath ? `${currentPath}/${name}` : name;
        window.open(`${host}/api/nas/download?path=${encodeURIComponent(sub)}`, '_blank');
      }
    });
  });
}

function updateBreadcrumbs() {
  const bc = $('breadcrumbs');
  const parts = currentPath.split('/').filter(Boolean);
  let html = '<span class="crumb-root" onclick="navToBreadcrumb(-1)"><i class="fa-solid fa-house"></i> Root</span>';

  parts.forEach((p, idx) => {
    html += ` <i class="fa-solid fa-chevron-right" style="font-size:9px; opacity:0.4;"></i> <span class="crumb-part" onclick="navToBreadcrumb(${idx})">${p}</span>`;
  });
  bc.innerHTML = html;
}

window.navToBreadcrumb = function(idx) {
  if (idx === -1) {
    currentPath = '';
  } else {
    const parts = currentPath.split('/').filter(Boolean);
    currentPath = parts.slice(0, idx + 1).join('/');
  }
  updateBreadcrumbs();
  loadFiles();
};

// Search filter
$('search-files-input')?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = cachedFiles.filter(f => f.name.toLowerCase().includes(query));
  renderFileGrid(filtered);
});

// Create Folder
$('btn-create-folder')?.addEventListener('click', () => {
  if (isReadOnly) {
    alert('This partition is protected in Read-Only mode.');
    return;
  }
  $('modal-folder').style.display = 'flex';
  $('new-folder-name')?.focus();
});

$('btn-submit-mkdir')?.addEventListener('click', async () => {
  const name = $('new-folder-name')?.value?.trim();
  if (!name) return;
  const host = getHostUrl();

  try {
    const res = await fetch('/api/nas/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ piServerUrl: host, folderName: name, currentPath })
    }).then(r => r.json()).catch(() => null);

    $('modal-folder').style.display = 'none';
    $('new-folder-name').value = '';
    loadFiles();
  } catch (e) {
    alert('Error creating folder: ' + e.message);
  }
});

// File Upload
$('file-upload-input')?.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files || !files.length) return;
  if (isReadOnly) {
    alert('This partition is protected in Read-Only mode.');
    return;
  }

  const host = getHostUrl();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      await fetch('/api/nas/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          piServerUrl: host,
          targetPath: currentPath,
          filename: file.name,
          fileData: base64Data,
          isBase64: true
        })
      }).catch(() => {});
      if (i === files.length - 1) loadFiles();
    };
    reader.readAsDataURL(file);
  }
});

$('btn-refresh-files')?.addEventListener('click', () => {
  loadFiles();
});

// Auto-populate target host
if (localStorage.getItem('thoth_nas_host')) {
  $('nas-target-host').value = localStorage.getItem('thoth_nas_host');
} else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  $('nas-target-host').value = window.location.origin;
}

$('nas-target-host')?.addEventListener('change', () => {
  localStorage.setItem('thoth_nas_host', $('nas-target-host').value);
  loadDrives();
  loadFiles();
});

loadDrives();
loadFiles();
