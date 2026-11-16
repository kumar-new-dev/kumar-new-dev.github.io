(function () {
  'use strict';

  var CHANNEL_NAME = 'kumar-chat-v1';
  var STORE_KEY = 'kumar-chat-messages-v1';
  var NAME_KEY = 'kumar-chat-name-v1';
  var ROOM_KEY = 'kumar-chat-room-v1';
  var MAX_MESSAGES = 200;
  var ROOMS = ['General', 'Tech', 'Random'];

  var messagesEl = document.getElementById('messages');
  var roomLabelEl = document.getElementById('roomLabel');
  var composerEl = document.getElementById('composer');
  var messageInputEl = document.getElementById('messageInput');
  var nameInputEl = document.getElementById('nameInput');
  var saveNameBtn = document.getElementById('saveNameBtn');
  var nameStatusEl = document.getElementById('nameStatus');
  var hintEl = document.getElementById('hint');
  var roomButtons = Array.prototype.slice.call(document.querySelectorAll('[data-room]'));

  var currentRoom = localStorage.getItem(ROOM_KEY) || 'General';
  if (ROOMS.indexOf(currentRoom) === -1) currentRoom = 'General';
  var displayName = localStorage.getItem(NAME_KEY) || '';

  // BroadcastChannel gives instant cross-tab delivery; the 'storage' event
  // below is the fallback for contexts where it is unavailable.
  var bc = null;
  try {
    if ('BroadcastChannel' in window) bc = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) { bc = null; }

  function loadMessages() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function saveMessages(list) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-MAX_MESSAGES)));
    } catch (e) { /* storage full or unavailable — message stays on screen only */ }
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function nearBottom() {
    return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;
  }

  function renderRooms() {
    roomButtons.forEach(function (btn) {
      var active = btn.getAttribute('data-room') === currentRoom;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    roomLabelEl.textContent = '#' + currentRoom;
    messageInputEl.placeholder = 'Message #' + currentRoom;
  }

  function renderMessages() {
    var all = loadMessages();
    var roomMessages = all.filter(function (m) { return m.room === currentRoom; });
    var stick = nearBottom();
    messagesEl.innerHTML = '';
    if (roomMessages.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No messages yet in #' + currentRoom + ' — be the first to say hello.';
      messagesEl.appendChild(empty);
    } else {
      roomMessages.forEach(function (m) {
        var row = document.createElement('div');
        row.className = 'message' + (m.name === displayName && displayName ? ' own' : '');
        var head = document.createElement('div');
        head.className = 'message-head';
        var who = document.createElement('span');
        who.className = 'message-name';
        who.textContent = m.name;
        var time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = formatTime(m.ts);
        head.appendChild(who);
        head.appendChild(time);
        var body = document.createElement('div');
        body.className = 'message-text';
        body.textContent = m.text;
        row.appendChild(head);
        row.appendChild(body);
        messagesEl.appendChild(row);
      });
    }
    if (stick) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function updateNameUI() {
    nameInputEl.value = displayName;
    nameStatusEl.textContent = displayName ? 'Chatting as ' + displayName : '';
  }

  function sendMessage() {
    var text = messageInputEl.value.trim();
    if (!displayName) {
      hintEl.textContent = 'Pick a display name above first.';
      nameInputEl.focus();
      return;
    }
    if (!text) return;
    var msg = {
      id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      room: currentRoom,
      name: displayName,
      text: text,
      ts: Date.now()
    };
    var all = loadMessages();
    all.push(msg);
    saveMessages(all);
    if (bc) {
      try { bc.postMessage({ type: 'message', message: msg }); } catch (e) { /* fall back to storage event */ }
    }
    messageInputEl.value = '';
    hintEl.textContent = '';
    renderMessages();
    messagesEl.scrollTop = messagesEl.scrollHeight;
    messageInputEl.focus();
  }

  function setRoom(room) {
    if (ROOMS.indexOf(room) === -1) return;
    currentRoom = room;
    try { localStorage.setItem(ROOM_KEY, room); } catch (e) { /* ignore */ }
    renderRooms();
    renderMessages();
  }

  roomButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { setRoom(btn.getAttribute('data-room')); });
  });

  composerEl.addEventListener('submit', function (ev) {
    ev.preventDefault();
    sendMessage();
  });

  saveNameBtn.addEventListener('click', function () {
    var name = nameInputEl.value.trim().slice(0, 24);
    if (!name) {
      hintEl.textContent = 'Enter a display name first.';
      return;
    }
    displayName = name;
    try { localStorage.setItem(NAME_KEY, name); } catch (e) { /* ignore */ }
    hintEl.textContent = '';
    updateNameUI();
    renderMessages();
    messageInputEl.focus();
  });

  if (bc) {
    bc.onmessage = function (ev) {
      if (ev.data && ev.data.type === 'message') renderMessages();
    };
  }
  window.addEventListener('storage', function (ev) {
    if (ev.key === STORE_KEY) renderMessages();
  });

  renderRooms();
  updateNameUI();
  renderMessages();
})();
