import { materializeRichInlineLineRange, prepareRichInline, walkRichInlineLineRanges } from '@chenglou/pretext/rich-inline';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const notePath = window.api.getNotePath() || '/home/ethan/obsidian_vault/sticky_note.md';

let preparedParagraphs = [];
const LINE_HEIGHT = 24;

function loadAndRender() {
  const content = window.api.readNote(notePath);
  let tokens = [];
  try {
     tokens = window.api.parseMarkdown(content);
  } catch (err) {
     console.error("Markdown parse error:", err);
     return;
  }
  
  let paragraphs = [];
  let currentParagraph = [];

  function addTextTokens(text, font) {
    const regex = /(\[\[.*?\]\]|#[\w/-]+)/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
       if (match.index > lastIndex) {
          currentParagraph.push({ text: text.substring(lastIndex, match.index), font });
       }
       currentParagraph.push({ text: match[0], font, isSpecial: true });
       lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
       currentParagraph.push({ text: text.substring(lastIndex), font });
    }
  }

  function process(nodeList, font, indent = '') {
    if (!nodeList) return;
    for (let i = 0; i < nodeList.length; i++) {
      const node = nodeList[i];
      if (node.type === 'paragraph' || node.type === 'heading') {
        if (currentParagraph.length > 0) {
           paragraphs.push(currentParagraph);
           currentParagraph = [];
        }
        if (indent && node.type === 'paragraph') {
            currentParagraph.push({ text: indent, font });
        }
        process(node.tokens, node.type === 'heading' ? 'bold 20px monospace' : font, indent);
        if (currentParagraph.length > 0) {
           paragraphs.push(currentParagraph);
           currentParagraph = [];
        }
      } else if (node.type === 'list') {
         for (let j = 0; j < node.items.length; j++) {
            const item = node.items[j];
            if (currentParagraph.length > 0) {
              paragraphs.push(currentParagraph);
              currentParagraph = [];
            }
            const bullet = node.ordered ? `${j + 1}. ` : '• ';
            currentParagraph.push({ text: indent + bullet, font });
            process(item.tokens, font, indent + '   ');
            if (currentParagraph.length > 0) {
              paragraphs.push(currentParagraph);
              currentParagraph = [];
            }
         }
      } else if (node.type === 'checkbox') {
         const box = node.checked ? '☑ ' : '☐ ';
         currentParagraph.push({ text: box, font, isSpecial: true, isCheckbox: true });
      } else if (node.type === 'strong') {
        process(node.tokens, font.replace('normal', 'bold'), indent);
      } else if (node.type === 'em') {
        process(node.tokens, font.replace('normal', 'italic'), indent);
      } else if (node.type === 'text' || node.type === 'escape' || node.type === 'link') {
        if (node.tokens && node.tokens.length > 0) {
           process(node.tokens, font, indent);
        } else {
           addTextTokens(node.text || node.raw || "", font);
        }
      } else if (node.type === 'space') {
        currentParagraph.push({ text: node.raw, font });
      } else if (node.raw) {
        addTextTokens(node.raw, font);
      }
    }
  }

  process(tokens, 'normal 16px monospace');
  
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph);
  }

  paragraphs = paragraphs.filter(p => p.length > 0);

  preparedParagraphs = paragraphs.map(p => {
     try {
       return { items: p, prepared: prepareRichInline(p) };
     } catch (err) {
       console.error("Pretext prepare error:", err);
       return null;
     }
  }).filter(p => p !== null);

  render();
}

function render() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  
  ctx.clearRect(0, 0, width, height);
  ctx.textBaseline = 'top';
  
  let y = 30; // top padding
  const maxWidth = width - 40; // 20px padding left and right

  if (preparedParagraphs.length === 0) {
     ctx.font = 'italic 16px monospace';
     ctx.fillStyle = '#999999';
     ctx.fillText('Empty note...', 20, 30);
     return;
  }

  for (const p of preparedParagraphs) {
    walkRichInlineLineRanges(p.prepared, maxWidth, (range) => {
      const line = materializeRichInlineLineRange(p.prepared, range);
      let x = 20;
      for (const frag of line.fragments) {
         x += frag.gapBefore;
         
         const item = p.items[frag.itemIndex];
         ctx.font = item.font;
         
         if (item.isSpecial) {
            if (item.isCheckbox) {
              ctx.fillStyle = item.text.includes('☑') ? '#10b981' : '#333333';
            } else if (item.text.startsWith('#')) {
              ctx.fillStyle = '#10b981'; // Green for tags
            } else {
              ctx.fillStyle = '#8b5cf6'; // Purple for links
            }
         } else {
            ctx.fillStyle = '#333333';
         }

         ctx.fillText(frag.text, x, y);
         x += frag.occupiedWidth;
      }
      y += LINE_HEIGHT;
    });
    y += LINE_HEIGHT / 2; // Extra padding between paragraphs
  }

  // Render version tag
  const version = window.api.getVersion();
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.textAlign = 'right';
  ctx.fillText(`v${version}`, width - 10, height - 10);
  ctx.textAlign = 'left'; // Reset for next frame
}

// Watch window size
const ro = new ResizeObserver(() => render());
ro.observe(canvas);

// Initial load
loadAndRender();

// Watch file for changes
window.api.watchNote(notePath, () => {
  loadAndRender();
});

// Editing Logic
const editor = document.getElementById('editor');
let isEditing = false;

// Quick Open UI (Legacy, keeping but updating to context menu)
const quickOpen = document.createElement('div');
quickOpen.id = 'quick-open';
quickOpen.style.cssText = `
  position: absolute;
  top: 10%;
  left: 10%;
  width: 80%;
  height: 80%;
  background: #fdf6e3;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 10px 20px rgba(0,0,0,0.5);
  display: none;
  flex-direction: column;
  padding: 10px;
  z-index: 200;
  font-family: monospace;
`;

const searchInput = document.createElement('input');
searchInput.placeholder = 'Search notes...';
searchInput.style.cssText = `
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  margin-bottom: 10px;
  outline: none;
`;

const noteList = document.createElement('div');
noteList.style.cssText = `
  flex-grow: 1;
  overflow-y: auto;
`;

quickOpen.appendChild(searchInput);
quickOpen.appendChild(noteList);
document.body.appendChild(quickOpen);

// Initial color setup
const argColor = window.api.getNoteColor();
const noteEl = document.getElementById('note');
noteEl.style.background = argColor;

// Native context menu via Electron Menu API
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.api.showContextMenu(e.clientX, e.clientY);
});

window.api.onContextMenuAction((action, data) => {
  switch (action) {
    case 'new-note':
      window.api.createNewNote();
      break;
    case 'open-note':
      showQuickOpen();
      break;
    case 'set-color':
      noteEl.style.background = data;
      window.api.setNoteColor(notePath, data);
      break;
    case 'hide':
      window.api.closeNote(notePath);
      break;
    case 'archive':
      if (confirm('Archive this note? It will be moved to the "archive" folder.')) {
        window.api.archiveNote(notePath);
        window.api.closeNote(notePath);
      }
      break;
    case 'delete':
      if (confirm('Permanently delete this note?')) {
        window.api.deleteNote(notePath);
        window.api.closeNote(notePath);
      }
      break;
  }
});

let isQuickOpenVisible = false;

function showQuickOpen() {
  isQuickOpenVisible = true;
  quickOpen.style.display = 'flex';
  searchInput.value = '';
  updateNoteList();
  searchInput.focus();
}

function hideQuickOpen() {
  isQuickOpenVisible = false;
  quickOpen.style.display = 'none';
}

function updateNoteList() {
  const vaultPath = window.api.getVaultPath();
  const notes = window.api.listVault(vaultPath);
  const filter = searchInput.value.toLowerCase();
  
  noteList.innerHTML = '';
  notes.filter(n => n.name.toLowerCase().includes(filter)).forEach(note => {
    const item = document.createElement('div');
    item.textContent = note.name;
    item.style.cssText = `
      padding: 8px;
      cursor: pointer;
      border-radius: 4px;
    `;
    item.onmouseover = () => item.style.background = '#eee';
    item.onmouseout = () => item.style.background = 'transparent';
    item.onclick = () => {
      window.api.openNote(note.path);
      hideQuickOpen();
    };
    noteList.appendChild(item);
  });
}

searchInput.oninput = updateNoteList;

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (isQuickOpenVisible) hideQuickOpen();
  }
});

window.addEventListener('dblclick', () => {
  if (isEditing) return;
  isEditing = true;
  const content = window.api.readNote(notePath);
  editor.value = content;
  editor.style.display = 'block';
  canvas.style.display = 'none';
  editor.focus();
});

editor.addEventListener('blur', () => {
  if (!isEditing) return;
  saveAndClose();
});

editor.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeEditor();
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    saveAndClose();
  }
});

function saveAndClose() {
  const newContent = editor.value;
  window.api.saveNote(notePath, newContent);
  closeEditor();
}

function closeEditor() {
  isEditing = false;
  editor.style.display = 'none';
  canvas.style.display = 'block';
  loadAndRender(); // Ensure it re-renders immediately
}
