let _config = null;

async function loadConfig() {
  if (_config) return _config;
  let api = {}, file = {};
  try { const r = await fetch('/api/config'); if (r.ok) api = await r.json(); } catch(e) {}
  try { const r = await fetch('config/git_config.json'); if (r.ok) file = await r.json(); } catch(e) {}
  const apiTok = String(api.github_token || '').trim();
  const fileTok = String(file.github_token || '').trim();
  _config = {
    github_token: (apiTok && apiTok !== 'YOUR_GITHUB_TOKEN') ? apiTok : fileTok,
    github_owner: file.github_owner || '',
    github_repo: file.github_repo || '',
    data_file_path: file.data_file_path || 'data/posts.json',
    admin_password: api.admin_password || file.admin_password || 'admin1234'
  };
  return _config;
}

function isAdmin() {
  return sessionStorage.getItem('isAdmin') === 'true';
}

function requireAdmin() {
  if (!isAdmin()) {
    window.location.href = 'admin.html';
  }
}

function handleAgentLogin(event) {
  if (event) event.preventDefault();
  window.location.href = 'admin.html';
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseInline(text) {
  let parts = text.split('`');
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      parts[i] = `<code class="bg-surface-container px-1 py-0.5 rounded font-mono text-sm">${parts[i]}</code>`;
    } else {
      let temp = parts[i];
      temp = temp.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      temp = temp.replace(/\*(.*?)\*/g, '<em>$1</em>');
      temp = temp.replace(/~~(.*?)~~/g, '<del>$1</del>');
      temp = temp.replace(/\[(.*?)\]\((.*?)\)/g, (match, p1, p2) => {
        const cleanUrl = p2.trim();
        if (/^(https?:\/\/|mailto:)/i.test(cleanUrl)) {
          return `<a href="${cleanUrl}" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">${p1}</a>`;
        }
        return p1;
      });
      parts[i] = temp;
    }
  }
  return parts.join('');
}

function renderMarkdown(src) {
  if (!src) return '';
  const escaped = escapeHtml(src);
  const lines = escaped.split(/\r?\n/);
  let html = [];
  let inList = false;
  let inOrderList = false;
  let inCodeBlock = false;
  let codeBlockContent = [];
  let inQuote = false;
  let quoteContent = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre class="bg-on-surface text-surface-bright p-4 rounded-xl font-mono text-sm overflow-x-auto my-4"><code>${codeBlockContent.join('\n')}</code></pre>`);
        inCodeBlock = false;
        codeBlockContent = [];
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    if (line.trim().startsWith('&gt;')) {
      if (!inQuote) {
        inQuote = true;
      }
      quoteContent.push(line.trim().substring(4).trim());
      continue;
    } else {
      if (inQuote) {
        html.push(`<blockquote class="border-l-4 border-primary bg-surface-container-low pl-4 py-2 my-4 italic text-body">${parseInline(quoteContent.join('<br>'))}</blockquote>`);
        inQuote = false;
        quoteContent = [];
      }
    }

    if (line.trim() === '---') {
      if (inList) { html.push('</ul>'); inList = false; }
      if (inOrderList) { html.push('</ol>'); inOrderList = false; }
      html.push('<hr class="border-t border-border my-6">');
      continue;
    }

    let headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      if (inList) { html.push('</ul>'); inList = false; }
      if (inOrderList) { html.push('</ol>'); inOrderList = false; }
      let level = headerMatch[1].length;
      let text = parseInline(headerMatch[2]);
      let sizeClass = level === 1 ? 'text-headline-xl font-bold my-4' : 
                      level === 2 ? 'text-headline-lg font-bold my-3' : 
                      'text-headline-sm font-semibold my-2';
      html.push(`<h${level} class="${sizeClass} text-on-surface">${text}</h${level}>`);
      continue;
    }

    let listMatch = line.match(/^[-*+]\s+(.*)$/);
    if (listMatch) {
      if (inOrderList) { html.push('</ol>'); inOrderList = false; }
      if (!inList) {
        html.push('<ul class="list-disc pl-6 my-4 space-y-1 text-body">');
        inList = true;
      }
      html.push(`<li>${parseInline(listMatch[1])}</li>`);
      continue;
    }

    let orderListMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (orderListMatch) {
      if (inList) { html.push('</ul>'); inList = false; }
      if (!inOrderList) {
        html.push('<ol class="list-decimal pl-6 my-4 space-y-1 text-body">');
        inOrderList = true;
      }
      html.push(`<li>${parseInline(orderListMatch[2])}</li>`);
      continue;
    }

    if (line.trim() === '') {
      if (inList) { html.push('</ul>'); inList = false; }
      if (inOrderList) { html.push('</ol>'); inOrderList = false; }
      continue;
    }

    if (inList) { html.push('</ul>'); inList = false; }
    if (inOrderList) { html.push('</ol>'); inOrderList = false; }

    html.push(`<p class="mb-4 text-body leading-relaxed">${parseInline(line)}</p>`);
  }

  if (inCodeBlock) {
    html.push(`<pre class="bg-on-surface text-surface-bright p-4 rounded-xl font-mono text-sm overflow-x-auto my-4"><code>${codeBlockContent.join('\n')}</code></pre>`);
  }
  if (inQuote) {
    html.push(`<blockquote class="border-l-4 border-primary bg-surface-container-low pl-4 py-2 my-4 italic text-body">${parseInline(quoteContent.join('<br>'))}</blockquote>`);
  }
  if (inList) { html.push('</ul>'); }
  if (inOrderList) { html.push('</ol>'); }

  return html.join('\n');
}

function markdownToText(src) {
  if (!src) return '';
  let txt = src.replace(/---[\s\S]*?---/, ''); // Remove frontmatter if present
  txt = txt.replace(/^(#{1,6})\s+/gm, '');
  txt = txt.replace(/^[-*+]\s+/gm, '');
  txt = txt.replace(/^\d+\.\s+/gm, '');
  txt = txt.replace(/```[\s\S]*?```/g, '');
  txt = txt.replace(/`([^`]+)`/g, '$1');
  txt = txt.replace(/\*\*([^*]+)\*\*/g, '$1');
  txt = txt.replace(/\*([^*]+)\*/g, '$1');
  txt = txt.replace(/~~([^~]+)~~/g, '$1');
  txt = txt.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  txt = txt.replace(/^>\s+/gm, '');
  return txt.replace(/\s+/g, ' ').trim();
}

async function githubFetch(url, options = {}) {
  const conf = await loadConfig();
  const token = String(conf.github_token || '').replace(/\s+/g, '').trim();
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    ...options.headers
  };
  if (token && token !== 'YOUR_GITHUB_TOKEN') {
    headers['Authorization'] = `token ${token}`;
  }
  return fetch(url, { ...options, headers });
}

async function getPosts() {
  const conf = await loadConfig();
  let posts = [];
  const localData = localStorage.getItem('posts');
  if (localData) {
    posts = JSON.parse(localData);
  }

  if (conf.github_token && conf.github_token !== 'YOUR_GITHUB_TOKEN' && conf.github_owner && conf.github_repo) {
    try {
      const url = `https://api.github.com/repos/${conf.github_owner}/${conf.github_repo}/contents/${conf.data_file_path}`;
      const res = await githubFetch(url);
      if (res.ok) {
        const fileInfo = await res.json();
        const content = decodeURIComponent(escape(atob(fileInfo.content)));
        posts = JSON.parse(content);
        localStorage.setItem('posts', JSON.stringify(posts));
        localStorage.setItem('posts_sha', fileInfo.sha);
      }
    } catch (e) {
      console.error('Failed to sync from GitHub, using local data', e);
    }
  }

  if (posts.length === 0) {
    try {
      const res = await fetch(conf.data_file_path);
      if (res.ok) {
        posts = await res.json();
        localStorage.setItem('posts', JSON.stringify(posts));
      }
    } catch(e) {
      console.error('Failed to load local static posts', e);
    }
  }

  return posts.sort((a, b) => b.id - a.id);
}

async function savePost(post) {
  const conf = await loadConfig();
  let posts = await getPosts();

  if (post.id) {
    const idx = posts.findIndex(p => p.id === Number(post.id));
    if (idx !== -1) {
      posts[idx] = { ...posts[idx], ...post, id: Number(post.id) };
    }
  } else {
    const maxId = posts.reduce((max, p) => p.id > max ? p.id : max, 0);
    post.id = maxId + 1;
    posts.unshift(post);
  }

  localStorage.setItem('posts', JSON.stringify(posts));

  if (conf.github_token && conf.github_token !== 'YOUR_GITHUB_TOKEN' && conf.github_owner && conf.github_repo) {
    let sha = localStorage.getItem('posts_sha') || '';
    const url = `https://api.github.com/repos/${conf.github_owner}/${conf.github_repo}/contents/${conf.data_file_path}`;

    if (!sha) {
      try {
        const res = await githubFetch(url);
        if (res.ok) {
          const fileInfo = await res.json();
          sha = fileInfo.sha;
        }
      } catch (e) {}
    }

    const utf8Bytes = new TextEncoder().encode(JSON.stringify(posts, null, 2));
    let base64Content = '';
    const binString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
    base64Content = btoa(binString);

    const body = {
      message: post.id ? `feat: update post ${post.id}` : `feat: create new post ${post.title}`,
      content: base64Content
    };
    if (sha) body.sha = sha;

    const res = await githubFetch(url, {
      method: 'PUT',
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub save failed: ${err.message}`);
    } else {
      const fileInfo = await res.json();
      localStorage.setItem('posts_sha', fileInfo.content.sha);
    }
  }
  return post;
}

async function deletePost(id) {
  const conf = await loadConfig();
  let posts = await getPosts();
  posts = posts.filter(p => p.id !== Number(id));

  localStorage.setItem('posts', JSON.stringify(posts));

  if (conf.github_token && conf.github_token !== 'YOUR_GITHUB_TOKEN' && conf.github_owner && conf.github_repo) {
    let sha = localStorage.getItem('posts_sha') || '';
    const url = `https://api.github.com/repos/${conf.github_owner}/${conf.github_repo}/contents/${conf.data_file_path}`;

    if (!sha) {
      try {
        const res = await githubFetch(url);
        if (res.ok) {
          const fileInfo = await res.json();
          sha = fileInfo.sha;
        }
      } catch (e) {}
    }

    const utf8Bytes = new TextEncoder().encode(JSON.stringify(posts, null, 2));
    const binString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
    const base64Content = btoa(binString);

    const body = {
      message: `feat: delete post ${id}`,
      content: base64Content
    };
    if (sha) body.sha = sha;

    const res = await githubFetch(url, {
      method: 'PUT',
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub delete failed: ${err.message}`);
    } else {
      const fileInfo = await res.json();
      localStorage.setItem('posts_sha', fileInfo.content.sha);
    }
  }
}
