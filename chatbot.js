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
    // Each entry: topic id, keywords (optionally weighted), response, optional followups
    // Weights default to 1. Give rare/specific words higher weights.
    const KB = [
        {
            id: 'shipping',
            topic: 'Shipping',
            keywords: [
                { w: ['ship', 'shipping', 'delivery', 'deliver', 'dispatch'], weight: 3 },
                { w: ['how long', 'when arrive', 'arriv', 'days', 'weeks'], weight: 2 },
                { w: ['france', 'eu', 'europe', 'uk', 'us', 'usa', 'canada', 'worldwide', 'international'], weight: 1 }
            ],
            response: "We ship worldwide from Strasbourg, France. Delivery times:\n• France: 3–5 business days\n• EU: 5–7 business days\n• UK: 4–7 business days\n• US/Canada: 7–12 business days\n• Rest of world: 10–18 business days\n\nFree shipping on orders over €50. We use La Poste, DHL, or Chronopost depending on destination. You'll get a tracking number by email as soon as your order ships."
        },
        {
            id: 'returns',
            topic: 'Returns',
            keywords: [
                { w: ['return', 'returns', 'refund', 'refunds', 'rétractation', 'retour', 'remboursement'], weight: 3 },
                { w: ['send back', 'money back', '14 day', '14-day', 'withdrawal'], weight: 2 }
            ],
            response: "Under French law you have 14 days from delivery to return a piece. Conditions (strict):\n• Unworn — no signs of wear\n• Original LÉTHÉ pouch\n• Hang tag still attached\n• Original packaging intact\n\nReturn shipping is at your charge (use a tracked method). If the piece meets conditions, we refund within 14 days of receiving it. Engraved or personalized pieces are final-sale.\n\nDamaged on arrival? That's different — we cover return shipping and replace or refund. Email hello@lethe.store with photos within 14 days of delivery."
        },
        {
            id: 'damaged',
            topic: 'Damaged item',
            keywords: [
                { w: ['damaged', 'broken', 'broke', 'defective', 'faulty', 'snapped', 'bent', 'cracked'], weight: 3 },
                { w: ['arrived broken', 'came broken', 'not working', 'arrived damaged'], weight: 3 }
            ],
            response: "Sorry this happened. Quality issues are always on us — we replace or refund, and we cover return shipping. Email hello@lethe.store within 14 days of delivery with:\n• Your order number\n• 2–3 photos of the damage\n• Photo of packaging if that's damaged too\n\nYou're covered by the 2-year French conformity guarantee (Art. L217-3) plus our 1-year craftsmanship warranty."
        },
        {
            id: 'wrong-item',
            topic: 'Wrong / missing item',
            keywords: [
                { w: ['wrong', 'missing', 'different'], weight: 2 },
                { w: ['wrong item', 'wrong bracelet', 'not what i ordered', 'different item', 'received the wrong', 'missing item', 'missing from order', 'one piece missing', "didn't receive everything"], weight: 3 }
            ],
            response: "We'll make this right fast. Email hello@lethe.store with:\n• Your order number\n• What you received vs what you ordered\n• Photos if helpful\n\nWe send the correct piece the same day (or the missing one), and cover all shipping on our mistake."
        },
        {
            id: 'cancel-change',
            topic: 'Cancel / change order',
            keywords: [
                { w: ['cancel', 'modify'], weight: 2 },
                { w: ['cancel order', 'cancel my order', 'change address', 'wrong address', 'modify order', 'change order'], weight: 3 }
            ],
            response: "Act fast — we ship within 48 hours. If your order is still 'Pending' or 'Processing', we can cancel or change it for free. Email hello@lethe.store with your order number right now. Once shipped we cannot cancel; you'll need to use the 14-day return window after delivery."
        },
        {
            id: 'tracking',
            topic: 'Tracking',
            keywords: [
                { w: ['track', 'tracking', 'status'], weight: 3 },
                { w: ['where is my order', 'where order', 'my order', "hasn't arrived", 'not arrived', 'when will', 'shipped yet'], weight: 3 }
            ],
            response: "Track your order at /track.html — enter your order number and email. You'll see current status and tracking link.\n\nDispatch times: we ship within 48 hours from Strasbourg. Delivery: France 3–5 days, EU 5–7 days, UK 4–7 days, US/Canada 7–12 days, ROW 10–18 days. If 'Pending' after 3+ business days, email hello@lethe.store."
        },
        {
            id: 'allergy',
            topic: 'Allergy / skin reaction',
            keywords: [
                { w: ['allergic', 'allergy', 'rash', 'irritation', 'itchy'], weight: 3 },
                { w: ['skin reaction', 'red mark', 'red marks'], weight: 2 }
            ],
            response: "LÉTHÉ pieces are 925 sterling silver — nickel-free and hypoallergenic. True silver allergies affect under 1% of people; the cause is almost always perfume or lotion residue under the piece.\n\nTry: stop wearing for 1–3 days, clean with mild soap, apply products BEFORE putting the bracelet on. If it persists within your 14-day window and the piece is still unused, email hello@lethe.store with a photo."
        },
        {
            id: 'sizing',
            topic: 'Sizing',
            keywords: [
                { w: ['size', 'sizing', 'length', 'wrist', 'measure', 'fit'], weight: 3 },
                { w: ['too small', 'too big', 'too large', 'cm'], weight: 2 }
            ],
            response: "Most bracelets are 16 cm + 3 cm extender (fits 15–19 cm wrists). Cuffs adjust 15–18 cm. Measure: wrap string around your wrist, mark overlap, measure against ruler, add 1 cm.\n\nNeed a different size? Use the 14-day withdrawal window — piece must be unworn with hang tag attached."
        },
        {
            id: 'care',
            topic: 'Care & tarnish',
            keywords: [
                { w: ['tarnish', 'tarnished', 'polish', 'polishing'], weight: 3 },
                { w: ['care', 'clean', 'cleaning', 'storage', 'store', 'maintain'], weight: 2 },
                { w: ['dark', 'black', 'dull', 'wash', 'water', 'shower', 'swim', 'swimming', 'chlorine'], weight: 1 }
            ],
            response: "All silver tarnishes — it's normal and always reversible. Use the polishing cloth that came with your LÉTHÉ pouch: rub gently 30–60 seconds. For heavier tarnish: warm water + mild soap + soft toothbrush.\n\nPrevent tarnish: remove before shower/sleep/swimming, avoid perfume/lotion/chlorine, store in pouch."
        },
        {
            id: 'material',
            topic: 'Materials',
            keywords: [
                { w: ['material', 'silver', 'nickel', 'sterling', 'hypoallergenic'], weight: 3 },
                { w: ['925', 'made of', 'what is it made'], weight: 2 },
                { w: ['plating', 'plated', 'gold'], weight: 1 }
            ],
            response: "Every LÉTHÉ piece is crafted in 925 sterling silver — nickel-free and hypoallergenic. Some styles incorporate cubic zirconia stones (Lune Tennis) or finer polish finishes. We never use cheap plating."
        },
        {
            id: 'payment',
            topic: 'Payment',
            keywords: [
                { w: ['payment', 'pay', 'card', 'visa', 'mastercard', 'paypal', 'stripe', 'billing'], weight: 3 },
                { w: ['apple pay', 'google pay', 'charged', 'card declined', 'double charge', 'paid twice', 'discount code'], weight: 2 }
            ],
            response: "We accept major cards (Visa, Mastercard, Amex), Apple Pay, Google Pay, and PayPal via Stripe. Most payment issues are temporary authorizations that drop off in 3–5 days. For double charges or discount issues, email hello@lethe.store with the transaction dates and order number — we resolve within 24 hours."
        },
        {
            id: 'warranty',
            topic: 'Warranty',
            keywords: [
                { w: ['warranty', 'guarantee', 'conformity'], weight: 3 },
                { w: ['légale', 'broken after', 'stopped working', 'years'], weight: 1 }
            ],
            response: "LÉTHÉ pieces are covered by France's 2-year legal conformity guarantee (Art. L217-3) plus our 1-year craftsmanship warranty on manufacturing defects. Email hello@lethe.store with photos, order number, and description. Most claims approved within 48 hours."
        },
        {
            id: 'wholesale',
            topic: 'Wholesale',
            keywords: [
                { w: ['wholesale', 'stockist', 'retailer', 'b2b', 'bulk'], weight: 3 },
                { w: ['stock your brand', 'linesheet', 'resell'], weight: 2 }
            ],
            response: "We work with selected stockists. Email wholesale@lethe.store with: store name + website, location, average price point, opening order budget, and how you found us. We reply within 3 business days with our linesheet and terms."
        },
        {
            id: 'engraving',
            topic: 'Engraving',
            keywords: [
                { w: ['engrave', 'engraving', 'personalize', 'personalise', 'custom', 'customize', 'initials'], weight: 3 }
            ],
            response: "We offer engraving on chain bracelets and cuffs: initials/short text (+€8), dates (+€12), custom symbols quoted case-by-case. Turnaround is +5–7 days on top of shipping. Engraved pieces are final-sale (no returns unless defective). Email hello@lethe.store with the piece you want and the text."
        },
        {
            id: 'gift',
            topic: 'Gifts',
            keywords: [
                { w: ['gift', 'gifting', 'present', 'birthday', 'anniversary'], weight: 3 },
                { w: ['gift card', 'packaging', 'wrap', 'handwritten'], weight: 2 }
            ],
            response: "Every LÉTHÉ piece ships gift-ready in our pouch with a polishing cloth. You can add a handwritten note free at checkout. Top gift picks: Aurora Bangle (€28), Céleste Chain (€34), Sienna Heart (€32) for romance, or Lune Tennis (€52) for a statement. Gift cards coming soon."
        },
        {
            id: 'privacy',
            topic: 'Privacy / data',
            keywords: [
                { w: ['unsubscribe', 'gdpr', 'privacy', 'cookie', 'cookies'], weight: 3 },
                { w: ['stop emails', 'delete my account', 'my data'], weight: 2 }
            ],
            response: "Unsubscribe via the link at the bottom of any LÉTHÉ email — instant. To delete your account entirely (GDPR right), email privacy@lethe.store with 'Delete my account'. We erase everything within 30 days."
        },
        {
            id: 'exchange',
            topic: 'Exchange',
            keywords: [
                { w: ['exchange', 'swap', 'switch'], weight: 3 }
            ],
            response: "Exchanges are allowed within the 14-day window only, and we treat them as a return + a new order. That means the original piece must come back unworn, in its LÉTHÉ pouch with hang tag attached, and return shipping is at your charge. Place the new order whenever suits you. Email returns@lethe.store to start."
        },
        {
            id: 'price',
            topic: 'Price',
            keywords: [
                { w: ['price', 'prices', 'cost', 'expensive', 'cheap', 'budget'], weight: 3 },
                { w: ['how much', 'how many euros', 'euro'], weight: 2 }
            ],
            response: "Our pieces range from €26 to €52. Bestsellers:\n• Aurora Bangle — €28\n• Céleste Chain Bracelet — €34\n• Mira Paperclip Chain — €36\n• Lune Tennis Bracelet — €52\n\nEvery piece comes in a LÉTHÉ pouch with a polishing cloth, ready to gift."
        },
        {
            id: 'contact',
            topic: 'Contact a human',
            keywords: [
                { w: ['contact', 'email', 'phone', 'human', 'person', 'agent', 'support'], weight: 3 },
                { w: ['talk to someone', 'speak to someone', 'real person', 'help me'], weight: 2 }
            ],
            response: "To reach a real person: email hello@lethe.store (we reply within 24 hours, Mon–Fri). For return questions: returns@lethe.store. For wholesale: wholesale@lethe.store. Include your order number in the subject line when relevant. We're a small team based in Strasbourg."
        },
        {
            id: 'about',
            topic: 'About LÉTHÉ',
            keywords: [
                { w: ['about', 'founder', 'origin', 'story', 'brand'], weight: 3 },
                { w: ['who are you', 'who made', 'strasbourg', 'where are you'], weight: 2 }
            ],
            response: "LÉTHÉ was founded in 2026 in Strasbourg, France. The name comes from Greek mythology — the river of forgetting. Our pieces are designed to be worn so often you forget they're there, but never tire of them. Small team, big taste."
        },
        {
            id: 'product-aurora',
            topic: 'Aurora Bangle',
            keywords: [
                { w: ['aurora', 'bangle'], weight: 3 }
            ],
            response: "Aurora Bangle — €28. A sleek adjustable cuff in 925 sterling silver, fits 15–18 cm wrists. One of our bestsellers. Free shipping if you cross €50 — pair it with a Céleste Chain (€34) and you're there."
        },
        {
            id: 'product-celeste',
            topic: 'Céleste Chain',
            keywords: [
                { w: ['celeste', 'céleste'], weight: 3 },
                { w: ['chain bracelet', 'chain'], weight: 1 }
            ],
            response: "Céleste Chain Bracelet — €34. Delicate 925 sterling silver chain, 16 cm + 3 cm extender. Layers beautifully with the Aurora Bangle. Engravable on the small plate (+€8 initials, +€12 date)."
        },
        {
            id: 'product-lune',
            topic: 'Lune Tennis',
            keywords: [
                { w: ['lune', 'tennis'], weight: 3 },
                { w: ['cubic zirconia', 'stones'], weight: 1 }
            ],
            response: "Lune Tennis Bracelet — €52. A full line of cubic zirconia stones set in 925 sterling silver. Statement piece, still light on the wrist. Our top-tier bestseller."
        },
        {
            id: 'product-mira',
            topic: 'Mira Paperclip',
            keywords: [
                { w: ['mira', 'paperclip'], weight: 3 }
            ],
            response: "Mira Paperclip Chain — €36. Modern elongated links in 925 sterling silver. Minimalist, unisex, stacks well with any of our other pieces."
        },
        {
            id: 'product-sienna',
            topic: 'Sienna Heart',
            keywords: [
                { w: ['sienna', 'heart'], weight: 3 }
            ],
            response: "Sienna Heart — €32. A small polished heart charm on a 925 sterling silver chain. Our go-to romance gift (birthday, anniversary, Valentine's)."
        },
        {
            id: 'greeting',
            topic: 'Greeting',
            keywords: [
                { w: ['hello', 'hi', 'hey', 'bonjour', 'salut', 'yo', 'hola', 'hiya'], weight: 3 }
            ],
            response: "Hi! I'm the LÉTHÉ assistant. I can help with shipping, returns, damaged items, order tracking, sizing, care, engraving, payment, and more. What do you want to know?"
        },
        {
            id: 'thanks',
            topic: 'Thanks',
            keywords: [
                { w: ['thanks', 'thank you', 'merci', 'cheers', 'appreciate', 'thx', 'ty'], weight: 3 }
            ],
            response: "You're welcome. Anything else I can help with?"
        },
        {
            id: 'bye',
            topic: 'Goodbye',
            keywords: [
                { w: ['bye', 'goodbye', 'see you', 'ciao', 'later', 'au revoir'], weight: 3 }
            ],
            response: "Take care — come back any time. — LÉTHÉ"
        }
    ];

    // Short follow-up lookups (pronouns / ellipsis) — routed via last topic
    const FOLLOWUP_KEYWORDS = [
        'how long', 'when', 'where', 'how much', 'what about', 'and', 'really',
        'ok', 'okay', 'why', 'tell me more', 'more', 'details', 'example',
        'how', 'it', 'that', 'this', 'one'
    ];

    const QUICK_REPLIES = [
        { label: 'Shipping', query: 'shipping' },
        { label: 'Returns', query: 'returns' },
        { label: 'Damaged item', query: 'damaged' },
        { label: 'Track order', query: 'track order' },
        { label: 'Contact human', query: 'contact' }
    ];

    const GREETING = "Hello 🤍 I'm the LÉTHÉ assistant. Ask me about shipping, returns, sizing, materials, care, orders — anything about your LÉTHÉ experience.";

    const STORAGE_KEY = 'lethe_chat_history_v2';
    const CONTEXT_KEY = 'lethe_chat_ctx_v1';

    // ============ UTILITIES ============
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
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (e) {}
    }

    function loadContext() {
        try {
            const raw = sessionStorage.getItem(CONTEXT_KEY);
            return raw ? JSON.parse(raw) : { lastTopic: null };
        } catch (e) {
            return { lastTopic: null };
        }
    }

    function saveContext(ctx) {
        try { sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx)); } catch (e) {}
    }

    // Light diacritic strip so "céleste" matches "celeste"
    function normalize(str) {
        return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    // Levenshtein distance (iterative, O(n*m) but bounded by short tokens)
    function lev(a, b) {
        if (a === b) return 0;
        const al = a.length, bl = b.length;
        if (!al) return bl;
        if (!bl) return al;
        if (Math.abs(al - bl) > 2) return 3; // early-out: we only care about ≤2
        let prev = new Array(bl + 1);
        let curr = new Array(bl + 1);
        for (let j = 0; j <= bl; j++) prev[j] = j;
        for (let i = 1; i <= al; i++) {
            curr[0] = i;
            for (let j = 1; j <= bl; j++) {
                const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
            }
            [prev, curr] = [curr, prev];
        }
        return prev[bl];
    }

    // Fuzzy token match: substring OR Levenshtein ≤ 1 for tokens ≥ 4 chars, ≤ 2 for ≥ 6 chars
    function fuzzyTokenMatch(tok, kw) {
        if (tok === kw) return true;
        if (tok.indexOf(kw) !== -1 || kw.indexOf(tok) !== -1) return true;
        if (kw.length < 4 || tok.length < 4) return false;
        const d = lev(tok, kw);
        if (kw.length >= 6 && d <= 2) return true;
        if (kw.length >= 4 && d <= 1) return true;
        return false;
    }

    // ============ INTENT MATCHING ============
    // Returns { score, entry } sorted by score desc
    function scoreEntries(text) {
        if (!text) return [];
        const normText = normalize(text);
        const tokens = normText.split(/[^a-z0-9€]+/).filter(Boolean);

        const results = [];
        for (const entry of KB) {
            let score = 0;
            for (const group of entry.keywords) {
                const weight = group.weight || 1;
                let groupMatched = false;
                for (const kwRaw of group.w) {
                    const kw = normalize(kwRaw);
                    if (kw.indexOf(' ') !== -1) {
                        // phrase → substring check
                        if (normText.indexOf(kw) !== -1) {
                            score += weight * 2; // phrases count double
                            groupMatched = true;
                        }
                    } else {
                        for (const t of tokens) {
                            if (fuzzyTokenMatch(t, kw)) {
                                score += weight;
                                groupMatched = true;
                                break;
                            }
                        }
                    }
                }
                void groupMatched; // reserved for future boosts
            }
            if (score > 0) results.push({ score, entry });
        }
        results.sort((a, b) => b.score - a.score);
        return results;
    }

    // Split a user turn into sub-queries on "and", ",", ";", " also " — so one message can hit two intents
    function splitMultiIntent(text) {
        const parts = text.split(/\band\b|,|;| also |\/| plus |\. /i).map(s => s.trim()).filter(Boolean);
        return parts.length > 1 ? parts : [text];
    }

    function isFollowup(text) {
        const norm = normalize(text).trim();
        if (norm.length <= 3) return true; // "ok", "why"
        const wordCount = norm.split(/\s+/).length;
        if (wordCount > 6) return false;
        return FOLLOWUP_KEYWORDS.some(k => norm === k || norm.startsWith(k + ' ') || norm.endsWith(' ' + k));
    }

    function buildFallback(topScored) {
        // Suggest the top 3 topics we half-matched, or the defaults if nothing matched
        const suggestions = (topScored && topScored.length)
            ? topScored.slice(0, 3).map(r => r.entry.topic)
            : ['Shipping', 'Returns', 'Damaged item', 'Track order'];
        const list = suggestions.map(s => `• ${s}`).join('\n');
        return `Hmm, I didn't quite catch that. Did you mean one of these?\n${list}\n\nOr email hello@lethe.store for anything else.`;
    }

    /**
     * Main entrypoint. Returns { text, topicId, secondary? }
     */
    function respond(userText, ctx) {
        const trimmed = String(userText || '').trim();
        if (!trimmed) return { text: buildFallback([]), topicId: null };

        // 1. Follow-up routing: if user sent a tiny vague message and we have a last topic, reuse it
        if (isFollowup(trimmed) && ctx && ctx.lastTopic) {
            const last = KB.find(e => e.id === ctx.lastTopic);
            if (last) {
                // If they also typed a real keyword, the full scorer will override below — so only use this if scorer is empty
                const scored = scoreEntries(trimmed);
                if (scored.length === 0) {
                    return { text: last.response, topicId: last.id, followup: true };
                }
            }
        }

        // 2. Multi-intent: split on "and" / "," and score each sub-query
        const parts = splitMultiIntent(trimmed);
        if (parts.length > 1) {
            const replies = [];
            const topicIds = [];
            for (const p of parts) {
                const scored = scoreEntries(p);
                if (scored.length && scored[0].score >= 2) {
                    if (topicIds.indexOf(scored[0].entry.id) === -1) {
                        replies.push(scored[0].entry.response);
                        topicIds.push(scored[0].entry.id);
                    }
                }
            }
            if (replies.length >= 2) {
                return {
                    text: replies.join('\n\n— — —\n\n'),
                    topicId: topicIds[topicIds.length - 1]
                };
            }
        }

        // 3. Single-intent scoring
        const scored = scoreEntries(trimmed);
        if (scored.length === 0) {
            return { text: buildFallback([]), topicId: null };
        }

        const top = scored[0];
        const second = scored[1];
        // Require a minimum confidence of 2 so random words don't trigger the first KB entry
        if (top.score < 2) {
            return { text: buildFallback(scored), topicId: null };
        }
        // Ambiguous (very close scores) → show top match but hint at second
        if (second && (top.score - second.score) <= 1 && top.score < 4) {
            return {
                text: top.entry.response + `\n\n(If you meant "${second.entry.topic}" instead, just say so.)`,
                topicId: top.entry.id
            };
        }
        return { text: top.entry.response, topicId: top.entry.id };
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
        let ctx = loadContext();
        let quickHidden = false;

        function renderQuickReplies() {
            quickEl.innerHTML = '';
            QUICK_REPLIES.forEach(qr => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'lethe-quick-chip';
                chip.textContent = qr.label;
                chip.addEventListener('click', () => handleUserMessage(qr.query));
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
            requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
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

            showTyping();
            // Typing delay scales a little with response length — feels more natural
            const base = 450;
            const jitter = Math.floor(Math.random() * 350);
            const delay = base + jitter;

            setTimeout(() => {
                removeTyping();
                const result = respond(text, ctx);
                appendMessage('bot', result.text);
                if (result.topicId) {
                    ctx.lastTopic = result.topicId;
                    saveContext(ctx);
                }
            }, delay);
        }

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
            if (windowEl.classList.contains('is-open')) closeChat(); else openChat();
        });
        closeBtn.addEventListener('click', closeChat);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && windowEl.classList.contains('is-open')) closeChat();
        });

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
            history.forEach(m => appendMessage(m.role, m.text, false));
            if (history.some(m => m.role === 'user')) hideQuickReplies();
        } else {
            history = [];
            appendMessage('bot', GREETING);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
