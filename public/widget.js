/**
 * Relay Chat Widget
 * Embeddable chat widget for Relay-powered AI assistants.
 *
 * Usage:
 *   <script src="https://your-domain.com/widget.js" data-assistant-id="YOUR_ASSISTANT_ID"></script>
 *
 * Optional attributes:
 *   data-position="bottom-right"  (default) | "bottom-left"
 */
(function () {
  'use strict';

  // Locate the script tag that loaded this file so we can read its attributes
  // and derive the server URL from the script src.
  var scriptTag = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var assistantId = scriptTag.getAttribute('data-assistant-id');
  if (!assistantId) {
    console.warn('[Relay Widget] Missing data-assistant-id attribute on script tag. Widget will not load.');
    return;
  }

  // data-position attribute can override the server-configured position
  var positionOverride = scriptTag.getAttribute('data-position');
  var position = positionOverride || 'bottom-right'; // will be updated from config if not overridden
  var serverOrigin = new URL(scriptTag.src).origin;
  var apiBase = serverOrigin + '/api/widget/' + assistantId;

  // Default config — overwritten by the server response
  var config = {
    name: 'Assistant',
    welcome_message: '',
    primary_color: '#10b981',
    avatar_url: null,
    lead_capture_enabled: false,
    lead_capture_fields: [],
    quick_replies: [],
    is_offline: false,
    offline_message: "We're currently outside our support hours. Please leave your details and we'll get back to you as soon as we're available.",
    cookie_consent_enabled: false,
  };

  // Cookie consent state — checked against localStorage on init
  var cookieConsented = false;

  // true once the user has clicked a quick reply or sent their first message (hides the buttons)
  var quickRepliesUsed = false;

  var messages = [];
  var conversationId = null;  // persists across sends within the same page session
  var isHandedOff = false;    // true once a handoff has been triggered
  var pollInterval = null;    // setInterval handle for polling human messages
  var lastPollTime = null;    // ISO timestamp of the last poll
  var isOpen = false;
  var isLoading = false;

  // Lead capture state
  var leadCaptured = false;   // true once the pre-chat form has been submitted
  var leadData = {};          // { user_name, user_email, user_phone }

  // DOM references — set after render()
  var widget, toggleBtn, panel, messagesEl, inputEl, sendBtn, footerEl, leadFormEl;

  // ---------------------------------------------------------------------------
  // Initialise
  // ---------------------------------------------------------------------------

  function init() {
    fetch(apiBase + '/config')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.name)                  config.name = data.name;
        if (data.welcome_message)       config.welcome_message = data.welcome_message;
        if (data.primary_color)         config.primary_color = data.primary_color;
        if (data.widget_position && !positionOverride) position = data.widget_position;
        if (data.avatar_url)            config.avatar_url = data.avatar_url;
        if (data.lead_capture_enabled)  config.lead_capture_enabled = data.lead_capture_enabled;
        if (data.lead_capture_fields)   config.lead_capture_fields = data.lead_capture_fields;
        if (data.quick_replies)           config.quick_replies = data.quick_replies;
        if (data.is_offline !== undefined) config.is_offline = data.is_offline;
        if (data.offline_message)       config.offline_message = data.offline_message;
        if (data.cookie_consent_enabled !== undefined) config.cookie_consent_enabled = data.cookie_consent_enabled;
        // Check if visitor has already consented (stored in localStorage)
        if (config.cookie_consent_enabled) {
          cookieConsented = localStorage.getItem('relay_consent_' + assistantId) === 'true';
        }
      })
      .catch(function () { /* use defaults */ })
      .finally(function () {
        render();
        if (!config.lead_capture_enabled && !config.is_offline && config.welcome_message) {
          addMessage('assistant', config.welcome_message);
        }
      });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function render() {
    injectStyles();

    widget = document.createElement('div');
    widget.id = 'relay-widget';
    widget.className = 'relay-pos-' + (position === 'bottom-left' ? 'left' : 'right');

    // Panel
    panel = document.createElement('div');
    panel.id = 'relay-panel';
    panel.setAttribute('aria-live', 'polite');
    panel.style.display = 'none';
    panel.innerHTML = [
      '<div id="relay-header" style="background:' + config.primary_color + '">',
      '  <div id="relay-header-info">',
      config.avatar_url
        ? '  <img id="relay-avatar" src="' + escapeHtml(config.avatar_url) + '" alt="" />'
        : '',
      '  <div id="relay-header-name">' + escapeHtml(config.name) + '</div>',
      '  </div>',
      '  <button id="relay-close-btn" aria-label="Close chat">',
      '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '  </button>',
      '</div>',
      '<div id="relay-lead-form" style="display:none;"></div>',
      '<div id="relay-messages"></div>',
      '<div id="relay-footer">',
      '  <input id="relay-input" type="text" placeholder="Type a message..." autocomplete="off" />',
      '  <button id="relay-send-btn" style="background:' + config.primary_color + '" aria-label="Send message">',
      '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
      '  </button>',
      '</div>',
    ].join('');

    // Toggle button
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'relay-toggle-btn';
    toggleBtn.style.background = config.primary_color;
    toggleBtn.setAttribute('aria-label', 'Open chat');
    toggleBtn.innerHTML = iconChat();
    toggleBtn.addEventListener('click', togglePanel);

    widget.appendChild(panel);
    widget.appendChild(toggleBtn);
    document.body.appendChild(widget);

    // Wire up internal elements
    messagesEl = document.getElementById('relay-messages');
    leadFormEl  = document.getElementById('relay-lead-form');
    footerEl    = document.getElementById('relay-footer');
    inputEl     = document.getElementById('relay-input');
    sendBtn     = document.getElementById('relay-send-btn');

    document.getElementById('relay-close-btn').addEventListener('click', closePanel);
    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Panel open / close
  // ---------------------------------------------------------------------------

  function togglePanel() {
    if (isOpen) { closePanel(); } else { openPanel(); }
  }

  function openPanel() {
    // Show cookie consent banner first if enabled and not yet consented
    if (config.cookie_consent_enabled && !cookieConsented) {
      showConsentBanner();
      return;
    }

    isOpen = true;
    panel.style.display = 'flex';
    toggleBtn.innerHTML = iconClose();
    toggleBtn.setAttribute('aria-label', 'Close chat');

    // Outside active hours — show the offline contact form
    if (config.is_offline) {
      showOfflineForm();
    // Show lead capture form if enabled and not yet completed
    } else if (config.lead_capture_enabled && !leadCaptured) {
      showLeadForm();
    } else {
      renderMessages();
      if (!quickRepliesUsed && config.quick_replies && config.quick_replies.length > 0) {
        renderQuickReplies();
      }
      setTimeout(function () { inputEl && inputEl.focus(); }, 100);
    }
  }

  // ---------------------------------------------------------------------------
  // Cookie consent banner
  // ---------------------------------------------------------------------------

  function showConsentBanner() {
    // Remove any existing banner
    var existing = document.getElementById('relay-consent-banner');
    if (existing) existing.remove();

    var banner = document.createElement('div');
    banner.id = 'relay-consent-banner';
    banner.innerHTML = [
      '<div id="relay-consent-inner">',
      '  <p id="relay-consent-text">This chat uses cookies and local storage to maintain your session. By continuing, you agree to our use of these technologies.</p>',
      '  <div id="relay-consent-btns">',
      '    <button id="relay-consent-accept" style="background:' + config.primary_color + '">Accept &amp; Continue</button>',
      '    <button id="relay-consent-decline">Decline</button>',
      '  </div>',
      '</div>',
    ].join('');

    document.body.appendChild(banner);

    document.getElementById('relay-consent-accept').addEventListener('click', function () {
      cookieConsented = true;
      localStorage.setItem('relay_consent_' + assistantId, 'true');
      banner.remove();
      openPanel();
    });

    document.getElementById('relay-consent-decline').addEventListener('click', function () {
      banner.remove();
    });
  }

  function closePanel() {
    isOpen = false;
    panel.style.display = 'none';
    toggleBtn.innerHTML = iconChat();
    toggleBtn.setAttribute('aria-label', 'Open chat');
  }

  // ---------------------------------------------------------------------------
  // Lead capture form
  // ---------------------------------------------------------------------------

  function getEnabledFields() {
    return (config.lead_capture_fields || []).filter(function (f) { return f.enabled; });
  }

  function showLeadForm() {
    var fields = getEnabledFields();
    if (fields.length === 0) {
      // No enabled fields — skip straight to chat
      leadCaptured = true;
      if (config.welcome_message) addMessage('assistant', config.welcome_message);
      renderMessages();
      return;
    }

    // Hide normal chat UI, show form
    messagesEl.style.display = 'none';
    footerEl.style.display = 'none';
    leadFormEl.style.display = 'flex';

    var c = config.primary_color;
    var fieldHtml = fields.map(function (f) {
      var inputType = f.field === 'email' ? 'email' : f.field === 'phone' ? 'tel' : 'text';
      var required = f.required ? ' required' : '';
      return [
        '<div class="relay-lf-group">',
        '<label class="relay-lf-label" for="relay-lf-' + f.field + '">' + escapeHtml(f.label) + (f.required ? ' <span class="relay-lf-req">*</span>' : '') + '</label>',
        '<input class="relay-lf-input" id="relay-lf-' + f.field + '" name="' + f.field + '" type="' + inputType + '" autocomplete="' + f.field + '"' + required + ' />',
        '</div>',
      ].join('');
    }).join('');

    leadFormEl.innerHTML = [
      '<div class="relay-lf-inner">',
      '<p class="relay-lf-title">Before we start, please share your details</p>',
      '<form id="relay-lf-form" novalidate>',
      fieldHtml,
      '<div id="relay-lf-error" class="relay-lf-error" style="display:none"></div>',
      '<button type="submit" class="relay-lf-submit" style="background:' + c + '">Start chatting</button>',
      '</form>',
      '</div>',
    ].join('');

    document.getElementById('relay-lf-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submitLeadForm();
    });

    // Focus first field
    setTimeout(function () {
      var first = leadFormEl.querySelector('input');
      if (first) first.focus();
    }, 100);
  }

  function submitLeadForm() {
    var fields = getEnabledFields();
    var errorEl = document.getElementById('relay-lf-error');
    var data = {};

    // Validate required fields
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      var input = document.getElementById('relay-lf-' + f.field);
      var val = input ? input.value.trim() : '';
      if (f.required && !val) {
        errorEl.textContent = 'Please fill in all required fields.';
        errorEl.style.display = 'block';
        if (input) input.focus();
        return;
      }
      if (val) {
        if (f.field === 'name')  data.user_name  = val;
        if (f.field === 'email') data.user_email = val;
        if (f.field === 'phone') data.user_phone = val;
      }
    }

    // Store lead data to send with the first message
    leadData = data;
    leadCaptured = true;

    // Transition to chat
    leadFormEl.style.display = 'none';
    leadFormEl.innerHTML = '';
    messagesEl.style.display = 'flex';
    footerEl.style.display = 'flex';

    if (config.welcome_message) addMessage('assistant', config.welcome_message);
    renderMessages();
    setTimeout(function () { inputEl && inputEl.focus(); }, 100);
  }

  // ---------------------------------------------------------------------------
  // Offline contact form — shown when assistant is outside active hours
  // ---------------------------------------------------------------------------

  // true once the offline form has been successfully submitted this session
  var offlineSubmitted = false;

  function showOfflineForm() {
    // Hide normal chat UI, show form
    messagesEl.style.display = 'none';
    footerEl.style.display = 'none';
    leadFormEl.style.display = 'flex';

    // If already submitted, just show the thank-you state
    if (offlineSubmitted) {
      leadFormEl.innerHTML = [
        '<div class="relay-lf-inner relay-offline-thanks">',
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="' + config.primary_color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        '<p class="relay-lf-title" style="text-align:center;">Message received!</p>',
        '<p class="relay-offline-sub">Thanks for reaching out. We\'ll get back to you as soon as we\'re back online.</p>',
        '</div>',
      ].join('');
      return;
    }

    var c = config.primary_color;
    leadFormEl.innerHTML = [
      '<div class="relay-lf-inner">',
      '<p class="relay-offline-msg">' + escapeHtml(config.offline_message) + '</p>',
      '<form id="relay-offline-form" novalidate>',
      '<div class="relay-lf-group">',
      '<label class="relay-lf-label" for="relay-ol-name">Name <span class="relay-lf-req">*</span></label>',
      '<input class="relay-lf-input" id="relay-ol-name" name="name" type="text" autocomplete="name" required />',
      '</div>',
      '<div class="relay-lf-group">',
      '<label class="relay-lf-label" for="relay-ol-email">Email address <span class="relay-lf-req">*</span></label>',
      '<input class="relay-lf-input" id="relay-ol-email" name="email" type="email" autocomplete="email" required />',
      '</div>',
      '<div class="relay-lf-group">',
      '<label class="relay-lf-label" for="relay-ol-message">Message <span style="color:#94a3b8;font-weight:400;">(optional)</span></label>',
      '<textarea class="relay-lf-input relay-ol-textarea" id="relay-ol-message" name="message" rows="3" placeholder="What can we help you with?"></textarea>',
      '</div>',
      '<div id="relay-ol-error" class="relay-lf-error" style="display:none"></div>',
      '<button type="submit" class="relay-lf-submit" style="background:' + c + '">Send message</button>',
      '</form>',
      '</div>',
    ].join('');

    document.getElementById('relay-offline-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submitOfflineForm();
    });

    setTimeout(function () {
      var first = leadFormEl.querySelector('input');
      if (first) first.focus();
    }, 100);
  }

  function submitOfflineForm() {
    var nameEl    = document.getElementById('relay-ol-name');
    var emailEl   = document.getElementById('relay-ol-email');
    var messageEl = document.getElementById('relay-ol-message');
    var errorEl   = document.getElementById('relay-ol-error');
    var submitBtn = leadFormEl.querySelector('button[type="submit"]');

    var name    = nameEl    ? nameEl.value.trim()    : '';
    var email   = emailEl   ? emailEl.value.trim()   : '';
    var message = messageEl ? messageEl.value.trim() : '';

    if (!name || !email) {
      errorEl.textContent = 'Please enter your name and email address.';
      errorEl.style.display = 'block';
      if (!name && nameEl) nameEl.focus();
      else if (!email && emailEl) emailEl.focus();
      return;
    }

    errorEl.style.display = 'none';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; }

    fetch(apiBase + '/offline-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email, message: message || undefined }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          errorEl.textContent = data.error;
          errorEl.style.display = 'block';
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send message'; }
          return;
        }
        offlineSubmitted = true;
        showOfflineForm(); // re-renders the thank-you state
      })
      .catch(function () {
        errorEl.textContent = 'Something went wrong. Please try again.';
        errorEl.style.display = 'block';
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send message'; }
      });
  }

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------

  function addMessage(role, content) {
    messages.push({ role: role, content: content });
    if (isOpen) renderMessages();
  }

  function renderMessages() {
    if (!messagesEl) return;
    // Preserve notice and quick-reply elements (appended separately, not in the messages array)
    var notices = messagesEl.querySelectorAll('.relay-notice');
    var qrEl = document.getElementById('relay-quick-replies');
    messagesEl.innerHTML = messages.map(function (m) {
      var isUser  = m.role === 'user';
      var isHuman = m.role === 'human'; // human agent message
      var bubbleStyle = isUser ? 'background:' + config.primary_color + ';color:#fff;' : '';
      var rowClass    = isUser ? 'relay-row-user' : 'relay-row-bot';
      var bubbleClass = isUser ? 'relay-bubble-user' : isHuman ? 'relay-bubble-agent' : 'relay-bubble-bot';
      var label = isHuman ? '<span class="relay-agent-label">Agent</span>' : '';
      return [
        '<div class="relay-row ' + rowClass + '">',
        '<div class="relay-bubble ' + bubbleClass + '" style="' + bubbleStyle + '">',
        label,
        escapeHtml(m.content),
        '</div></div>',
      ].join('');
    }).join('');
    // Re-append notices and quick replies after the message rebuild
    notices.forEach(function (n) { messagesEl.appendChild(n); });
    if (qrEl) messagesEl.appendChild(qrEl);
    scrollBottom();
  }

  function showTypingIndicator() {
    if (!messagesEl) return;
    var el = document.createElement('div');
    el.id = 'relay-typing';
    el.className = 'relay-row relay-row-bot';
    el.innerHTML = '<div class="relay-bubble relay-bubble-bot relay-typing"><span class="relay-dot"></span><span class="relay-dot"></span><span class="relay-dot"></span></div>';
    messagesEl.appendChild(el);
    scrollBottom();
  }

  function hideTypingIndicator() {
    var el = messagesEl && messagesEl.querySelector('#relay-typing');
    if (el) el.remove();
  }

  function scrollBottom() {
    if (messagesEl) {
      setTimeout(function () { messagesEl.scrollTop = messagesEl.scrollHeight; }, 16);
    }
  }

  // Renders quick reply buttons below the messages (disappear once one is tapped or a message is sent)
  function renderQuickReplies() {
    if (!messagesEl || quickRepliesUsed) return;
    // Remove any existing quick reply bar
    removeQuickReplies();
    var bar = document.createElement('div');
    bar.id = 'relay-quick-replies';
    config.quick_replies.forEach(function (text) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = text;
      btn.className = 'relay-qr-btn';
      btn.addEventListener('click', function () {
        dismissQuickReplies();
        if (inputEl) { inputEl.value = text; }
        sendMessage();
      });
      bar.appendChild(btn);
    });
    messagesEl.appendChild(bar);
    scrollBottom();
  }

  function removeQuickReplies() {
    var el = messagesEl && document.getElementById('relay-quick-replies');
    if (el) el.remove();
  }

  function dismissQuickReplies() {
    quickRepliesUsed = true;
    removeQuickReplies();
  }

  // Shows a neutral info notice inside the chat (not a user or bot message)
  function addNotice(text) {
    if (!messagesEl) return;
    var el = document.createElement('div');
    el.className = 'relay-notice';
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollBottom();
  }

  // ---------------------------------------------------------------------------
  // Human-agent polling — started after a handoff is triggered
  // ---------------------------------------------------------------------------

  function startPolling() {
    if (pollInterval) return;
    lastPollTime = new Date().toISOString();
    pollInterval = setInterval(pollForAgentMessages, 5000);
  }

  function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }

  function pollForAgentMessages() {
    if (!conversationId) return;
    var url = serverOrigin + '/api/widget/conversation/' + conversationId + '/poll';
    if (lastPollTime) { url += '?since=' + encodeURIComponent(lastPollTime); }
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (msgs) {
        if (!Array.isArray(msgs) || msgs.length === 0) return;
        lastPollTime = msgs[msgs.length - 1].created_at;
        msgs.forEach(function (msg) { addMessage('human', msg.content); });
        // Re-enable the input once a human agent has replied
        if (inputEl) {
          inputEl.disabled = false;
          inputEl.placeholder = 'Reply to the agent...';
        }
        if (sendBtn) sendBtn.disabled = false;
      })
      .catch(function () { /* silent — polling errors shouldn't disrupt the chat */ });
  }

  function sendMessage() {
    if (!inputEl || isLoading) return;
    var text = inputEl.value.trim();
    if (!text) return;

    // Dismiss quick replies on first user message
    if (!quickRepliesUsed) dismissQuickReplies();

    inputEl.value = '';
    addMessage('user', text);

    isLoading = true;
    if (sendBtn) sendBtn.disabled = true;
    if (inputEl) inputEl.disabled = true;
    showTypingIndicator();

    // Include lead data on the first message only (conversationId will be null on first send)
    var body = { messages: messages.slice(), conversation_id: conversationId };
    if (!conversationId && leadCaptured) {
      if (leadData.user_name)  body.user_name  = leadData.user_name;
      if (leadData.user_email) body.user_email = leadData.user_email;
      if (leadData.user_phone) body.user_phone = leadData.user_phone;
    }

    fetch(apiBase + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTypingIndicator();
        if (data.conversation_id) { conversationId = data.conversation_id; }
        addMessage('assistant', data.response || data.error || 'Sorry, I could not get a response right now.');
        if (data.handoff_triggered && !isHandedOff) {
          isHandedOff = true;
          addNotice('Your request has been passed to a human agent. We will be with you shortly.');
          if (inputEl) {
            inputEl.placeholder = 'Waiting for an agent...';
            inputEl.disabled = true;
          }
          if (sendBtn) sendBtn.disabled = true;
          startPolling();
        }
      })
      .catch(function () {
        hideTypingIndicator();
        addMessage('assistant', 'Something went wrong. Please try again.');
      })
      .finally(function () {
        isLoading = false;
        if (!isHandedOff) {
          if (sendBtn) sendBtn.disabled = false;
          if (inputEl) { inputEl.disabled = false; inputEl.focus(); }
        }
      });
  }

  // ---------------------------------------------------------------------------
  // Icons
  // ---------------------------------------------------------------------------

  function iconChat() {
    return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  }

  function iconClose() {
    return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }

  function hexToRgba(hex, alpha) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return 'rgba(16,185,129,' + alpha + ')';
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + alpha + ')';
  }

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  function injectStyles() {
    var c = config.primary_color;
    var focusRing = hexToRgba(c, 0.2);
    var css = [
      /* Widget container */
      '#relay-widget{position:fixed;bottom:24px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}',
      '#relay-widget.relay-pos-right{right:24px;}',
      '#relay-widget.relay-pos-left{left:24px;}',

      /* Toggle button */
      '#relay-toggle-btn{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.22);transition:transform .2s,box-shadow .2s;padding:0;}',
      '#relay-toggle-btn:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(0,0,0,0.28);}',

      /* Panel */
      '#relay-panel{position:absolute;bottom:68px;width:360px;background:#fff;border-radius:16px;box-shadow:0 8px 48px rgba(0,0,0,0.16);flex-direction:column;overflow:hidden;animation:relay-fade-up .2s ease;}',
      '.relay-pos-right #relay-panel{right:0;}',
      '.relay-pos-left #relay-panel{left:0;}',
      '@keyframes relay-fade-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',

      /* Header */
      '#relay-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;color:#fff;flex-shrink:0;}',
      '#relay-header-info{display:flex;align-items:center;gap:10px;min-width:0;}',
      '#relay-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.35);flex-shrink:0;}',
      '#relay-header-name{font-weight:600;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#relay-close-btn{background:none;border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:2px;opacity:.85;border-radius:6px;flex-shrink:0;}',
      '#relay-close-btn:hover{opacity:1;}',

      /* Cookie consent banner */
      '#relay-consent-banner{position:fixed;bottom:96px;z-index:2147483647;max-width:360px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}',
      '.relay-pos-right ~ #relay-consent-banner,#relay-widget.relay-pos-right + #relay-consent-banner{right:24px;}',
      '#relay-consent-banner{right:24px;}',
      '#relay-consent-inner{background:#fff;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.15);padding:18px 20px;display:flex;flex-direction:column;gap:12px;}',
      '#relay-consent-text{margin:0;font-size:13px;line-height:1.55;color:#475569;}',
      '#relay-consent-btns{display:flex;gap:8px;}',
      '#relay-consent-accept{flex:1;padding:9px 14px;border:none;border-radius:9px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity .2s;}',
      '#relay-consent-accept:hover{opacity:.85;}',
      '#relay-consent-decline{padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:9px;background:#fff;color:#64748b;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:background .15s;}',
      '#relay-consent-decline:hover{background:#f8fafc;}',

      /* Messages */
      '#relay-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;min-height:0;max-height:360px;}',
      '.relay-row{display:flex;}',
      '.relay-row-user{justify-content:flex-end;}',
      '.relay-row-bot{justify-content:flex-start;}',
      '.relay-bubble{max-width:80%;padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.55;word-wrap:break-word;white-space:pre-wrap;}',
      '.relay-bubble-user{border-bottom-right-radius:4px;}',
      '.relay-bubble-bot{background:#f1f5f9;color:#1e293b;border-bottom-left-radius:4px;}',

      /* Typing indicator */
      '.relay-typing{display:flex;align-items:center;gap:4px;padding:12px 16px;}',
      '.relay-dot{display:inline-block;width:7px;height:7px;background:#94a3b8;border-radius:50%;animation:relay-bounce 1.2s infinite ease-in-out;}',
      '.relay-dot:nth-child(2){animation-delay:.2s;}',
      '.relay-dot:nth-child(3){animation-delay:.4s;}',
      '@keyframes relay-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}',

      /* Footer */
      '#relay-footer{display:flex;gap:8px;padding:12px 14px;border-top:1px solid #e2e8f0;flex-shrink:0;}',
      '#relay-input{flex:1;border:1.5px solid #e2e8f0;border-radius:10px;padding:9px 13px;font-size:14px;outline:none;font-family:inherit;transition:border-color .15s,box-shadow .15s;background:#fff;color:#1e293b;}',
      '#relay-input:focus{border-color:' + c + ';box-shadow:0 0 0 3px ' + focusRing + ';}',
      '#relay-input:disabled{opacity:.5;}',
      '#relay-send-btn{width:38px;height:38px;border:none;border-radius:10px;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;transition:opacity .2s;flex-shrink:0;padding:0;}',
      '#relay-send-btn:hover{opacity:.85;}',
      '#relay-send-btn:disabled{opacity:.35;cursor:not-allowed;}',

      /* Human agent message bubble */
      '.relay-bubble-agent{background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-bottom-left-radius:4px;}',
      '.relay-agent-label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;color:#b45309;}',

      /* Info notice (handoff alert, system messages) */
      '.relay-notice{margin:8px auto;padding:9px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:12px;color:#166534;text-align:center;max-width:88%;}',

      /* Lead capture form */
      '#relay-lead-form{flex:1;overflow-y:auto;padding:20px 18px;flex-direction:column;}',
      '.relay-lf-inner{display:flex;flex-direction:column;gap:14px;}',
      '.relay-lf-title{font-size:14px;font-weight:600;color:#1e293b;margin:0 0 4px;}',
      '.relay-lf-group{display:flex;flex-direction:column;gap:4px;}',
      '.relay-lf-label{font-size:12px;font-weight:500;color:#475569;}',
      '.relay-lf-req{color:#ef4444;}',
      '.relay-lf-input{border:1.5px solid #e2e8f0;border-radius:10px;padding:9px 13px;font-size:14px;outline:none;font-family:inherit;transition:border-color .15s,box-shadow .15s;background:#fff;color:#1e293b;width:100%;box-sizing:border-box;}',
      '.relay-lf-input:focus{border-color:' + c + ';box-shadow:0 0 0 3px ' + focusRing + ';}',
      '.relay-lf-submit{width:100%;padding:10px;border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .2s;font-family:inherit;margin-top:4px;}',
      '.relay-lf-submit:hover{opacity:.88;}',
      '.relay-lf-error{font-size:12px;color:#dc2626;padding:6px 10px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;}',

      /* Quick reply buttons */
      '#relay-quick-replies{display:flex;flex-wrap:wrap;gap:6px;padding:4px 0 6px;}',
      '.relay-qr-btn{border:1.5px solid ' + c + ';background:#fff;color:' + c + ';border-radius:20px;padding:6px 14px;font-size:13px;font-family:inherit;cursor:pointer;transition:background .15s,color .15s;white-space:nowrap;}',
      '.relay-qr-btn:hover{background:' + c + ';color:#fff;}',

      /* Offline form extras */
      '.relay-offline-msg{font-size:13px;color:#475569;margin:0 0 4px;line-height:1.5;}',
      '.relay-offline-sub{font-size:13px;color:#475569;text-align:center;margin:6px 0 0;line-height:1.5;}',
      '.relay-ol-textarea{resize:vertical;min-height:72px;line-height:1.5;}',
      '.relay-offline-thanks{align-items:center;gap:10px;padding:12px 0;}',

      /* Responsive */
      '@media(max-width:420px){#relay-panel{width:calc(100vw - 32px);}',
      '.relay-pos-right #relay-panel{right:-8px;}',
      '.relay-pos-left #relay-panel{left:-8px;}}',
    ].join('');

    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
