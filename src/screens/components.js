// Tiny DOM toolkit + shared renderers used by every screen. No innerHTML with
// user data — everything is built with createElement / textContent (XSS-safe).

/** Minimal hyperscript. h('div', {className, text, onclick, dataset, attrs}, ...children) */
export function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
        if (v == null) continue;
        if (k === 'className') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v; // only used with trusted static strings
        else if (k === 'onclick') el.addEventListener('click', v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'attrs') for (const [a, val] of Object.entries(v)) el.setAttribute(a, val);
        else if (k === 'style') for (const [sk, sv] of Object.entries(v)) {
            // Custom properties (--x) must go through setProperty; direct assignment is ignored.
            if (sk.startsWith('--')) el.style.setProperty(sk, sv);
            else el.style[sk] = sv;
        }
        else el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
        if (c == null || c === false) continue;
        el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
}

export function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
}

/** Format big numbers: 1234 -> 1,234 ; 12345 -> 12.3k ; 1.2M ... */
export function fmt(n) {
    n = Math.round(n || 0);
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2).replace(/\.0+$/, '') + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2).replace(/\.0+$/, '') + 'M';
    if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toLocaleString('en-US');
}

// ── Toasts ─────────────────────────────────────────────────────────────────
let toastRoot = null;
export function setToastRoot(node) { toastRoot = node; }

export function toast(message, type = 'info') {
    if (!toastRoot) return;
    const t = h('div', { className: `toast toast-${type}`, text: message });
    toastRoot.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    }, 2600);
}

// ── Modal ──────────────────────────────────────────────────────────────────
let modalRoot = null;
export function setModalRoot(node) { modalRoot = node; }

export function openModal(contentNode, { onClose } = {}) {
    if (!modalRoot) return () => {};
    clear(modalRoot);
    const close = () => {
        modalRoot.classList.remove('open');
        clear(modalRoot);
        onClose?.();
    };
    const card = h('div', { className: 'modal-card', onclick: (e) => e.stopPropagation() }, contentNode);
    modalRoot.appendChild(card);
    modalRoot.onclick = close;
    modalRoot.classList.add('open');
    return close;
}

export function closeModal() {
    if (modalRoot) { modalRoot.classList.remove('open'); clear(modalRoot); }
}

export function confirmDialog({ title, message, confirmText = 'Confirm', cancelText = 'Cancel' }) {
    return new Promise((resolve) => {
        const body = h('div', { className: 'confirm' },
            h('h3', { text: title }),
            message ? h('p', { text: message }) : null,
            h('div', { className: 'confirm-actions' },
                h('button', { className: 'btn btn-ghost', text: cancelText, onclick: () => { closeModal(); resolve(false); } }),
                h('button', { className: 'btn btn-primary', text: confirmText, onclick: () => { closeModal(); resolve(true); } }),
            ),
        );
        openModal(body, { onClose: () => resolve(false) });
    });
}
