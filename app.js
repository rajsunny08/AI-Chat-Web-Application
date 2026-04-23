// ============================================================
//  NeuralChat — Frontend App
//  Talks to /api/chat (local Node.js proxy), NOT Anthropic directly.
//  This avoids all CORS issues.
// ============================================================

// ── State ──────────────────────────────────────────────────
const state = {
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  conversations: {},
  activeId: null,
  isStreaming: false,
};

// ── DOM refs ───────────────────────────────────────────────
const $ = id => document.getElementById(id);
const sidebar           = $('sidebar');
const sidebarToggle     = $('sidebarToggle');
const newChatBtn        = $('newChatBtn');
const historyList       = $('historyList');
const modelSelect       = $('modelSelect');
const apiKeyInput       = $('apiKeyInput');
const saveKeyBtn        = $('saveKeyBtn');
const keyStatus         = $('keyStatus');
const chatTitle         = $('chatTitle');
const clearBtn          = $('clearBtn');
const messagesContainer = $('messagesContainer');
const welcomeScreen     = $('welcomeScreen');
const messagesList      = $('messagesList');
const messageInput      = $('messageInput');
const sendBtn           = $('sendBtn');
const toast             = $('toast');

// ── Init ───────────────────────────────────────────────────
function init() {
  loadFromStorage();
  renderHistoryList();
  if (!state.activeId) startNewChat();
  else loadConversation(state.activeId);

  sidebarToggle.addEventListener('click', toggleSidebar);
  newChatBtn.addEventListener('click', startNewChat);
  saveKeyBtn.addEventListener('click', saveApiKey);
  clearBtn.addEventListener('click', clearCurrentChat);
  modelSelect.addEventListener('change', e => { state.model = e.target.value; saveToStorage(); });
  messageInput.addEventListener('input', onInputChange);
  messageInput.addEventListener('keydown', onKeyDown);
  sendBtn.addEventListener('click', sendMessage);

  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      messageInput.value = chip.dataset.text;
      onInputChange();
      sendMessage();
    });
  });

  document.addEventListener('click', e => {
    if (window.innerWidth <= 700 && sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) && e.target !== sidebarToggle) {
      sidebar.classList.remove('open');
    }
  });
}

// ── Storage ────────────────────────────────────────────────
function loadFromStorage() {
  try {
    const saved = localStorage.getItem('neuralchat');
    if (saved) {
      const p = JSON.parse(saved);
      state.apiKey       = p.apiKey       || '';
      state.model        = p.model        || 'claude-sonnet-4-20250514';
      state.conversations = p.conversations || {};
      state.activeId     = p.activeId     || null;
    }
  } catch {}
  if (state.apiKey) { apiKeyInput.value = state.apiKey; keyStatus.textContent = '✓ Key loaded'; }
  modelSelect.value = state.model;
}

function saveToStorage() {
  try {
    localStorage.setItem('neuralchat', JSON.stringify({
      apiKey: state.apiKey, model: state.model,
      conversations: state.conversations, activeId: state.activeId,
    }));
  } catch {}
}

// ── API Key ────────────────────────────────────────────────
function saveApiKey() {
  const key = apiKeyInput.value.trim();
  if (!key) { showToast('Please enter an API key', 'error'); return; }
  if (!key.startsWith('sk-ant-')) { showToast('Key should start with sk-ant-', 'error'); return; }
  state.apiKey = key;
  saveToStorage();
  keyStatus.textContent = '✓ Saved';
  showToast('API key saved ✓', 'success');
  setTimeout(() => { keyStatus.textContent = ''; }, 3000);
}

// ── Sidebar ────────────────────────────────────────────────
function toggleSidebar() {
  if (window.innerWidth <= 700) sidebar.classList.toggle('open');
  else sidebar.classList.toggle('collapsed');
}

// ── Conversations ──────────────────────────────────────────
function startNewChat() {
  const id = 'chat_' + Date.now();
  state.conversations[id] = { title: 'New Conversation', messages: [] };
  state.activeId = id;
  saveToStorage();
  loadConversation(id);
  renderHistoryList();
  messageInput.focus();
}

function loadConversation(id) {
  state.activeId = id;
  const conv = state.conversations[id];
  if (!conv) return;
  chatTitle.textContent = conv.title;
  messagesList.innerHTML = '';
  welcomeScreen.style.display = conv.messages.length === 0 ? 'flex' : 'none';
  conv.messages.forEach(m => appendMessage(m.role, m.content, false));
  renderHistoryList();
  scrollToBottom();
  saveToStorage();
}

function deleteConversation(id, e) {
  e.stopPropagation();
  delete state.conversations[id];
  if (state.activeId === id) {
    const ids = Object.keys(state.conversations);
    ids.length > 0 ? loadConversation(ids[ids.length - 1]) : startNewChat();
  }
  renderHistoryList();
  saveToStorage();
}

function clearCurrentChat() {
  if (!state.activeId) return;
  state.conversations[state.activeId].messages = [];
  state.conversations[state.activeId].title    = 'New Conversation';
  messagesList.innerHTML = '';
  chatTitle.textContent  = 'New Conversation';
  welcomeScreen.style.display = 'flex';
  renderHistoryList();
  saveToStorage();
}

function renderHistoryList() {
  historyList.innerHTML = '';
  const ids = Object.keys(state.conversations).reverse();
  if (ids.length === 0) {
    historyList.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:4px;">No conversations yet</p>';
    return;
  }
  ids.forEach(id => {
    const conv = state.conversations[id];
    const item = document.createElement('div');
    item.className = 'history-item' + (id === state.activeId ? ' active' : '');
    item.innerHTML = `
      <span class="history-item-title">${escapeHtml(conv.title)}</span>
      <button class="history-delete" title="Delete">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;
    item.addEventListener('click', () => loadConversation(id));
    item.querySelector('.history-delete').addEventListener('click', e => deleteConversation(id, e));
    historyList.appendChild(item);
  });
}

// ── Input ──────────────────────────────────────────────────
function onInputChange() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + 'px';
  sendBtn.disabled = !messageInput.value.trim() || state.isStreaming;
}

function onKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) sendMessage(); }
}

// ── Send Message ───────────────────────────────────────────
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || state.isStreaming) return;

  if (!state.apiKey) {
    showToast('Enter your Anthropic API key in the sidebar first', 'error');
    apiKeyInput.focus();
    return;
  }

  if (!state.activeId) startNewChat();

  welcomeScreen.style.display = 'none';

  const conv = state.conversations[state.activeId];
  conv.messages.push({ role: 'user', content: text });
  appendMessage('user', text);

  if (conv.messages.length === 1) {
    conv.title = text.length > 42 ? text.slice(0, 42) + '…' : text;
    chatTitle.textContent = conv.title;
    renderHistoryList();
  }

  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendBtn.disabled = true;
  saveToStorage();

  state.isStreaming = true;
  setSendLoading(true);

  const assistantEl = appendMessage('assistant', '', true);
  const textEl = assistantEl.querySelector('.message-text');

  try {
    // ── Call LOCAL proxy (avoids CORS) ──
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.apiKey,
      },
      body: JSON.stringify({
        model: state.model,
        max_tokens: 2048,
        stream: true,
        messages: conv.messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error || `HTTP ${response.status}`);
    }

    let fullText = '';
    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          if (json.type === 'content_block_delta' && json.delta?.text) {
            fullText += json.delta.text;
            textEl.innerHTML = renderMarkdown(fullText);
            textEl.classList.add('streaming-cursor');
            scrollToBottom();
          }
        } catch {}
      }
    }

    textEl.classList.remove('streaming-cursor');
    textEl.innerHTML = renderMarkdown(fullText);
    addCodeCopyButtons(textEl);
    addMessageActions(assistantEl, fullText);
    conv.messages.push({ role: 'assistant', content: fullText });
    saveToStorage();

  } catch (err) {
    textEl.classList.remove('streaming-cursor');
    textEl.innerHTML = `<span style="color:var(--danger)">⚠ ${escapeHtml(err.message)}</span>`;
    console.error(err);
  } finally {
    state.isStreaming = false;
    setSendLoading(false);
    onInputChange();
    scrollToBottom();
  }
}

// ── Render ─────────────────────────────────────────────────
function appendMessage(role, content, isLoading = false) {
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;
  wrap.innerHTML = `
    <div class="message-avatar">${role === 'user' ? 'U' : '◈'}</div>
    <div class="message-content">
      <div class="message-role">${role === 'user' ? 'You' : 'NeuralChat'}</div>
      <div class="message-text">${isLoading
        ? '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>'
        : renderMarkdown(content)}</div>
      <div class="message-actions"></div>
    </div>`;
  messagesList.appendChild(wrap);
  scrollToBottom();
  if (!isLoading && role === 'assistant') {
    addCodeCopyButtons(wrap.querySelector('.message-text'));
    addMessageActions(wrap, content);
  }
  return wrap;
}

function addMessageActions(el, text) {
  const actionsEl = el.querySelector('.message-actions');
  if (!actionsEl) return;
  const btn = document.createElement('button');
  btn.className = 'msg-action-btn';
  btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success'));
  });
  actionsEl.appendChild(btn);
}

function addCodeCopyButtons(el) {
  el.querySelectorAll('pre').forEach(pre => {
    if (pre.parentElement.classList.contains('code-block-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-block-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    const btn = document.createElement('button');
    btn.className = 'copy-code-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code')?.textContent || pre.textContent;
      navigator.clipboard.writeText(code).then(() => { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy'; }, 2000); });
    });
    wrap.appendChild(btn);
  });
}

function renderMarkdown(text) {
  if (!text) return '';
  let h = escapeHtml(text);
  h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => `<pre><code class="language-${lang}">${code.trim()}</code></pre>`);
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/^---$/gm, '<hr>');
  h = h.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>[\s\S]+?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>');
  h = h.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  h = h.split(/\n\n+/).map(block => {
    if (/^<(h[1-3]|ul|ol|pre|blockquote|hr)/.test(block.trim())) return block;
    if (!block.trim()) return '';
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  return h;
}

function escapeHtml(t) {
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function scrollToBottom() { messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' }); }
function setSendLoading(on) {
  if (on) { sendBtn.classList.add('loading'); sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>`; }
  else { sendBtn.classList.remove('loading'); sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`; }
}
let toastTimer;
function showToast(msg, type = '') {
  toast.textContent = msg; toast.className = 'toast show ' + type;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2800);
}

init();
