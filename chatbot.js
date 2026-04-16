/* ============================================
   LÉTHÉ CHATBOT
   Self-contained customer assistant with KB pattern matching.
   No external dependencies.
   ============================================ */
(function () {
    'use strict';

    if (window.__letheChatbotLoaded) return;
    window.__letheChatbotLoaded = true;

    // ============ KNOWLEDGE BASE ============
    const KB = [
        {
            keywords: ['ship', 'shipping', 'delivery', 'deliver', 'how long', 'when arrive', 'arriv', 'dispatch'],
            response: "We ship worldwide from Strasbourg, France. Delivery times:\n• France: 3–5 business days\n• EU: 5–7 business days\n• UK: 4–7 business days\n• US/Canada: 7–12 business days\n• Rest of world: 10–18 business days\n\nFree shipping on orders over €50. We use La Poste, DHL, or Chronopost depending on destination. You'll get a tracking number by email as soon as your order ships."
        },
        {
            keywords: ['return', 'refund', 'send back', 'money back', 'rétractation', 'retour', 'remboursement'],
            response: "Under French law you have 14 days from delivery to return a piece. Conditions (strict):\n• Unworn — no signs of wear\n• Original LÉTHÉ pouch\n• Hang tag still attached\n• Original packaging intact\n\nReturn shipping is at your charge (use a tracked method). If the piece meets conditions, we refund within 14 days of receiving it. Engraved or personalized pieces are final-sale.\n\nDamaged on arrival? That's different — we cover return shipping and replace or refund. Email hello@lethe.store with photos within 14 days of delivery."
        },
        {
            keywords: ['damaged', 'broken', 'broke', 'defective', 'faulty', 'arrived broken', 'came broken', 'not working', 'snapped', 'bent'],
            response: "Sorry this happened. Quality issues are always on us — we replace or refund, and we cover return shipping. Email hello@lethe.store within 14 days of delivery with:\n• Your order number\n• 2–3 photos of the damage\n• Photo of packaging if that's damaged too\n\nYou're covered by the 2-year French conformity guarantee (Art. L217-3) plus our 1-year craftsmanship warranty."
        },
        {
            keywords: ['wrong item', 'wrong bracelet', 'not what i ordered', 'different item', 'received the wrong', 'missing item', 'missing from order', 'one piece missing', "didn't receive everything"],
            response: "We'll make this right fast. Email hello@lethe.store with:\n• Your order number\n• What you received vs what you ordered\n• Photos if helpful\n\nWe send the correct piece the same day (or the missing one), and cover all shipping on our mistake."
        },
        {
            keywords: ['cancel order', 'cancel my order', 'change address', 'wrong address', 'modify order', 'change order'],
            response: "Act fast — we ship within 48 hours. If your order is still 'Pending' or 'Processing', we can cancel or change it for free. Email hello@lethe.store with your order number right now. Once shipped we cannot cancel; you'll need to use the 14-day return window after delivery."
        },
        {
            keywords: ['track', 'tracking', 'where is my order', 'where order', 'status', 'my order', "hasn't arrived", 'not arrived', 'when will', 'shipped yet'],
            response: "Track your order at /track.html — enter your order number and email. You'll see current status and tracking link.\n\nDispatch times: we ship within 48 hours from Strasbourg. Delivery: France 3–5 days, EU 5–7 days, UK 4–7 days, US/Canada 7–12 days, ROW 10–18 days. If 'Pending' after 3+ business days, email hello@lethe.store."
        },
        {
            keywords: ['allergic', 'allergy', 'rash', 'skin reaction', 'irritation', 'red mark', 'itchy'],
            response: "LÉTHÉ pieces are 925 sterling silver — nickel-free and hypoallergenic. True silver allergies affect under 1% of people; the cause is almost always perfume or lotion residue under the piece.\n\nTry: stop wearing for 1–3 days, clean with mild soap, apply products BEFORE putting the bracelet on. If it persists within your 14-day window and the piece is still unused, email hello@lethe.store with a photo."
        },
        {
            keywords: ['size', 'sizing', 'too small', 'too big', 'fit', 'length', 'wrist', 'measure'],
            response: "Most bracelets are 16 cm + 3 cm extender (fits 15–19 cm wrists). Cuffs adjust 15–18 cm. Measure: wrap string around your wrist, mark overlap, measure against ruler, add 1 cm.\n\nNeed a different size? Use the 14-day withdrawal window — piece must be unworn with hang tag attached."
        },
        {
            keywords: ['tarnish', 'tarnished', 'dark', 'black', 'dull', 'care', 'clean', 'polish', 'how to care', 'storage', 'wash', 'water', 'shower'],
            response: "All silver tarnishes — it's normal and always reversible. Use the polishing cloth that came with your LÉTHÉ pouch: rub gently 30–60 seconds. For heavier tarnish: warm water + mild soap + soft toothbrush.\n\nPrevent tarnish: remove before shower/sleep/swimming, avoid perfume/lotion/chlorine, store in pouch."
        },
        {
            keywords: ['material', 'made of', 'silver', 'nickel', '925', 'sterling', 'hypoallergenic'],
            response: "Every LÉTHÉ piece is crafted in 925 sterling silver — nickel-free and hypoallergenic. Some styles incorporate cubic zirconia stones (Lune Tennis) or finer polish finishes. We never use cheap plating."
        },
        {
            keywords: ['payment', 'pay', 'card', 'visa', 'mastercard', 'paypal', 'apple pay', 'google pay', 'stripe', 'charged', 'card declined', 'double charge', 'billing', 'paid twice', 'discount code'],
            response: "We accept major cards (Visa, Mastercard, Amex), Apple Pay, Google Pay, and PayPal via Stripe. Most payment issues are temporary authorizations that drop off in 3–5 days. For double charges or discount issues, email hello@lethe.store with the transaction dates and order number — we resolve within 24 hours."
        },
        {
            keywords: ['warranty', 'guarantee', 'conformity', 'légale', 'broken after', 'stopped working'],
            response: "LÉTHÉ pieces are covered by France's 2-year legal conformity guarantee (Art. L217-3) plus our 1-year craftsmanship warranty on manufacturing defects. Email hello@lethe.store with photos, order number, and description. Most claims approved within 48 hours."
        },
        {
            keywords: ['wholesale', 'stockist', 'stock your brand', 'retailer', 'b2b', 'bulk'],
            response: "We work with selected stockists. Email wholesale@lethe.store with: store name + website, location, average price point, opening order budget, and how you found us. We reply within 3 business days with our linesheet and terms."
        },
        {
            keywords: ['engrave', 'engraving', 'personalize', 'personalise', 'custom', 'initials', 'customize'],
            response: "We offer engraving on chain bracelets and cuffs: initials/short text (+€8), dates (+€12), custom symbols quoted case-by-case. Turnaround is +5–7 days on top of shipping. Engraved pieces are final-sale (no returns unless defective). Email hello@lethe.store with the piece you want and the text."
        },
        {
            keywords: ['gift', 'gifting', 'present', 'birthday', 'anniversary', 'gift card', 'packaging', 'box', 'wrap'],
            response: "Every LÉTHÉ piece ships gift-ready in our pouch with a polishing cloth. You can add a handwritten note free at checkout. Top gift picks: Aurora Bangle (€28), Céleste Chain (€34), Sienna Heart (€32) for romance, or Lune Tennis (€52) for a statement. Gift cards coming soon."
        },
        {
            keywords: ['unsubscribe', 'stop emails', 'delete my account', 'gdpr', 'data', 'privacy', 'cookie'],
            response: "Unsubscribe via the link at the bottom of any LÉTHÉ email — instant. To delete your account entirely (GDPR right), email privacy@lethe.store with 'Delete my account'. We erase everything within 30 days."
        },
        {
            keywords: ['exchange'],
            response: "Exchanges are allowed within the 14-day window only, and we treat them as a return + a new order. That means the original piece must come back unworn, in its LÉTHÉ pouch with hang tag attached, and return shipping is at your charge. Place the new order whenever suits you. Email returns@lethe.store to start."
        },
        {
            keywords: ['price', 'cost', 'how much', 'expensive', 'cheap', 'budget'],
            response: "Our pieces range from €26 to €52. Bestsellers:\n• Aurora Bangle — €28\n• Céleste Chain Bracelet — €34\n• Mira Paperclip Chain — €36\n• Lune Tennis Bracelet — €52\n\nEvery piece comes in a LÉTHÉ pouch with a polishing cloth, ready to gift."
        },
        {
            keywords: ['contact', 'email', 'phone', 'human', 'person', 'real', 'speak', 'agent', 'talk', 'support', 'help me'],
            response: "To reach a real person: email hello@lethe.store (we reply within 24 hours, Mon–Fri). For return questions: returns@lethe.store. For wholesale: wholesale@lethe.store. Include your order number in the subject line when relevant. We're a small team based in Strasbourg."
        },
        {
            keywords: ['about', 'who are you', 'who made', 'founder', 'story', 'origin', 'strasbourg'],
            response: "LÉTHÉ was founded in 2026 in Strasbourg, France. The name comes from Greek mythology — the river of forgetting. Our pieces are designed to be worn so often you forget they're there, but never tire of them. Small team, big taste."
        },
        {
            keywords: ['hello', 'hi', 'hey', 'bonjour', 'salut', 'yo', 'hola'],
            response: "Hi! I'm the LÉTHÉ assistant. I can help with shipping, returns, damaged items, order tracking, sizing, care, engraving, payment, and more. What do you want to know?"
        },
        {
            keywords: ['thanks', 'thank you', 'merci', 'cheers', 'appreciate'],
            response: "You're welcome. Anything else I can help with?"
        },
        {
            keywords: ['bye', 'goodbye', 'see you', 'ciao', 'later'],
            response: "Take care — come back any time. — LÉTHÉ"
        }
    ];

    const FALLBACK = "I'm not sure I caught that. I can help with: shipping & tracking, returns (14-day French policy), damaged or wrong items, cancelling/changing an order, sizing, care & tarnish, materials, payment, warranty, engraving, gifts, wholesale, or privacy. Or email hello@lethe.store for anything else.";

    const QUICK_REPLIES = [
        { label: 'Shipping', query: 'shipping' },
        { label: 'Returns', query: 'returns' },
        { label: 'Damaged item', query: 'damaged' },
        { label: 'Track order', query: 'track order' },
        { label: 'Contact human', query: 'contact' }
    ];

    const GREETING = "Hello 🤍 I'm the LÉTHÉ assistant. Ask me about shipping, returns, sizing, materials, care, orders — anything about your LÉTHÉ experience.";

    const STORAGE_KEY = 'lethe_chat_history_v1';

    // ============ UTILITIES ============
    function escapeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function loadHistory() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    function saveHistory(history) {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (e) {
            // storage full / disabled — fail silently
        }
    }

    // ============ INTENT MATCHING ============
    function findResponse(text) {
        if (!text) return FALLBACK;
        const lower = text.toLowerCase();
        const tokens = lower.split(/[^a-z0-9€]+/).filter(Boolean);
        const joined = ' ' + tokens.join(' ') + ' ';

        let bestScore = 0;
        let bestResponse = null;

        for (const entry of KB) {
            let score = 0;
            for (const kw of entry.keywords) {
                const kwLower = kw.toLowerCase();
                if (kwLower.indexOf(' ') !== -1) {
                    // multi-word phrase: substring match on full text
                    if (lower.indexOf(kwLower) !== -1) score += 1;
                } else {
                    // single word: substring match on tokens for stemming-lite
                    for (const t of tokens) {
                        if (t.indexOf(kwLower) !== -1 || kwLower.indexOf(t) !== -1) {
                            score += 1;
                            break;
                        }
                    }
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestResponse = entry.response;
            }
        }

        return bestScore > 0 ? bestResponse : FALLBACK;
    }

    // ============ UI ============
    const ICON_CHAT = '<svg class="lethe-icon-chat" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
    const ICON_CLOSE = '<svg class="lethe-icon-close" viewBox="0 0 24 24" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>';
    const ICON_SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/></svg>';

    function buildUI() {
        const wrapper = document.createElement('div');
        wrapper.className = 'lethe-chatbot-root';
        wrapper.innerHTML = `
            <button
                type="button"
                class="lethe-chatbot-fab"
                id="lethe-chatbot-fab"
                aria-label="Open LÉTHÉ assistant"
                aria-expanded="false">
                ${ICON_CHAT}
                ${ICON_CLOSE}
            </button>
            <div
                class="lethe-chatbot-window"
                id="lethe-chatbot-window"
                role="dialog"
                aria-labelledby="lethe-chatbot-title"
                aria-hidden="true">
                <div class="lethe-chatbot-header">
                    <div class="lethe-chatbot-header-info">
                        <h3 id="lethe-chatbot-title">LÉTHÉ Assistant</h3>
                        <p>Usually replies instantly</p>
                    </div>
                    <button
                        type="button"
                        class="lethe-chatbot-close"
                        id="lethe-chatbot-close"
                        aria-label="Close chat">&times;</button>
                </div>
                <div
                    class="lethe-chatbot-messages"
                    id="lethe-chatbot-messages"
                    role="log"
                    aria-live="polite"></div>
                <div
                    class="lethe-chatbot-quick"
                    id="lethe-chatbot-quick"></div>
                <form class="lethe-chatbot-input" id="lethe-chatbot-form" autocomplete="off">
                    <input
                        type="text"
                        id="lethe-chatbot-input"
                        placeholder="Type your message…"
                        aria-label="Message"
                        autocomplete="off">
                    <button
                        type="submit"
                        class="lethe-chatbot-send"
                        id="lethe-chatbot-send"
                        aria-label="Send message">
                        ${ICON_SEND}
                    </button>
                </form>
            </div>
        `;
        document.body.appendChild(wrapper);
        return wrapper;
    }

    // ============ CONTROLLER ============
    function init() {
        const root = buildUI();
        const fab = root.querySelector('#lethe-chatbot-fab');
        const windowEl = root.querySelector('#lethe-chatbot-window');
        const closeBtn = root.querySelector('#lethe-chatbot-close');
        const messagesEl = root.querySelector('#lethe-chatbot-messages');
        const quickEl = root.querySelector('#lethe-chatbot-quick');
        const form = root.querySelector('#lethe-chatbot-form');
        const input = root.querySelector('#lethe-chatbot-input');

        let history = loadHistory();
        let quickHidden = false;

        // Render quick replies
        function renderQuickReplies() {
            quickEl.innerHTML = '';
            QUICK_REPLIES.forEach(qr => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'lethe-quick-chip';
                chip.textContent = qr.label;
                chip.addEventListener('click', () => {
                    handleUserMessage(qr.query);
                });
                quickEl.appendChild(chip);
            });
        }

        function hideQuickReplies() {
            if (quickHidden) return;
            quickHidden = true;
            quickEl.classList.add('is-hidden');
        }

        function appendMessage(role, text, persist) {
            const msg = document.createElement('div');
            msg.className = 'lethe-msg ' + (role === 'user' ? 'lethe-msg-user' : 'lethe-msg-bot');
            msg.textContent = text;
            messagesEl.appendChild(msg);
            scrollToBottom();
            if (persist !== false) {
                history = history || [];
                history.push({ role: role, text: text });
                saveHistory(history);
            }
        }

        function scrollToBottom() {
            requestAnimationFrame(() => {
                messagesEl.scrollTop = messagesEl.scrollHeight;
            });
        }

        function showTyping() {
            const typing = document.createElement('div');
            typing.className = 'lethe-typing';
            typing.id = 'lethe-typing-indicator';
            typing.innerHTML = '<span></span><span></span><span></span>';
            messagesEl.appendChild(typing);
            scrollToBottom();
            return typing;
        }

        function removeTyping() {
            const t = document.getElementById('lethe-typing-indicator');
            if (t) t.remove();
        }

        function handleUserMessage(rawText) {
            const text = String(rawText || '').trim();
            if (!text) return;

            hideQuickReplies();
            appendMessage('user', text);
            input.value = '';
            input.focus();

            const typing = showTyping();
            const delay = 500 + Math.floor(Math.random() * 400); // 500–900ms

            setTimeout(() => {
                removeTyping();
                const reply = findResponse(text);
                appendMessage('bot', reply);
            }, delay);
        }

        // Open / close
        function openChat() {
            windowEl.classList.add('is-open');
            fab.classList.add('is-open');
            windowEl.setAttribute('aria-hidden', 'false');
            fab.setAttribute('aria-expanded', 'true');
            fab.setAttribute('aria-label', 'Close LÉTHÉ assistant');
            setTimeout(() => input.focus(), 320);
        }

        function closeChat() {
            windowEl.classList.remove('is-open');
            fab.classList.remove('is-open');
            windowEl.setAttribute('aria-hidden', 'true');
            fab.setAttribute('aria-expanded', 'false');
            fab.setAttribute('aria-label', 'Open LÉTHÉ assistant');
        }

        fab.addEventListener('click', () => {
            if (windowEl.classList.contains('is-open')) {
                closeChat();
            } else {
                openChat();
            }
        });

        closeBtn.addEventListener('click', closeChat);

        // Escape to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && windowEl.classList.contains('is-open')) {
                closeChat();
            }
        });

        // Input hides quick replies on typing
        input.addEventListener('input', () => {
            if (input.value.trim().length > 0) hideQuickReplies();
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handleUserMessage(input.value);
        });

        // ============ INITIAL RENDER ============
        renderQuickReplies();

        if (history && history.length > 0) {
            // Replay existing history silently (no persist, no animations interfering)
            history.forEach(m => appendMessage(m.role, m.text, false));
            // If history already has a user message, hide the quick replies
            if (history.some(m => m.role === 'user')) hideQuickReplies();
        } else {
            // Fresh session: show greeting
            history = [];
            appendMessage('bot', GREETING);
        }
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
