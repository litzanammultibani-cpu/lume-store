/* ============================================================
   VAIYN — Admin Finances module
   Self-contained. Reads orders from localStorage `vaiyn_orders`
   and products from DOM. All finance data lives under:
     vaiyn_finance_expenses   — array of expense records
     vaiyn_finance_costs      — { sku: { cost, updated } }
     vaiyn_finance_invoices   — { orderId: invoiceNumber }
     vaiyn_business_info      — business info object
   Numbered invoices roll per calendar year (CA-2026-0001 …).
   ============================================================ */
(function () {
    'use strict';

    // ============ STORAGE ============
    const K = {
        EXPENSES: 'vaiyn_finance_expenses',
        COSTS:    'vaiyn_finance_costs',
        INVOICES: 'vaiyn_finance_invoices',
        BUSINESS: 'vaiyn_business_info',
        ORDERS:   'vaiyn_orders',
        PRODUCTS: 'vaiyn_products'
    };

    const EXPENSE_CATEGORIES = [
        'Inventory / raw materials',
        'Packaging',
        'Shipping — outbound',
        'Shipping — inbound',
        'Marketing / advertising',
        'Website / domain / hosting',
        'Equipment / tools',
        'Professional fees',
        'Banking / payment fees',
        'Office / utilities',
        'Travel',
        'Other'
    ];

    const PAID_STATUSES = new Set([
        'Paid', 'Processing', 'Shipped', 'Delivered'
    ]);
    const NON_REVENUE_STATUSES = new Set([
        'Pending', 'Pending payment', 'Cancelled', 'Refunded'
    ]);

    // ============ UTILS ============
    const $  = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    function load(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
        catch (e) { return fallback; }
    }
    function save(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); }
        catch (e) { alert('Storage error: ' + e.message); }
    }
    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

    function fmt(n) {
        const v = Number(n) || 0;
        return '€' + v.toFixed(2);
    }
    function fmtDateISO(ts) {
        const d = new Date(ts);
        return d.toISOString().slice(0, 10);
    }
    function fmtDateLocal(ts) {
        const d = new Date(ts);
        if (isNaN(d)) return '—';
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]
        );
    }

    function countsAsRevenue(order) {
        if (!order || !order.status) return false;
        if (NON_REVENUE_STATUSES.has(order.status)) return false;
        return true; // Everything else counts (Paid, Processing, Shipped, Delivered, etc.)
    }

    // ============ PERIOD HELPERS ============
    function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
    function startOfQuarter(d) {
        const q = Math.floor(d.getMonth() / 3);
        return new Date(d.getFullYear(), q * 3, 1);
    }
    function startOfYear(d) { return new Date(d.getFullYear(), 0, 1); }

    function periodRange(key) {
        const now = new Date();
        let from, to, label;
        switch (key) {
            case 'month': {
                from = startOfMonth(now);
                to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
                label = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                break;
            }
            case 'last-month': {
                const s = startOfMonth(now);
                from = new Date(s.getFullYear(), s.getMonth() - 1, 1);
                to = s;
                label = from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                break;
            }
            case 'quarter': {
                from = startOfQuarter(now);
                to = new Date(from.getFullYear(), from.getMonth() + 3, 1);
                const q = Math.floor(from.getMonth() / 3) + 1;
                label = `Q${q} ${from.getFullYear()}`;
                break;
            }
            case 'last-quarter': {
                const s = startOfQuarter(now);
                from = new Date(s.getFullYear(), s.getMonth() - 3, 1);
                to = s;
                const q = Math.floor(from.getMonth() / 3) + 1;
                label = `Q${q} ${from.getFullYear()}`;
                break;
            }
            case 'year': {
                from = startOfYear(now);
                to = new Date(now.getFullYear() + 1, 0, 1);
                label = String(now.getFullYear());
                break;
            }
            case 'all':
            default:
                from = new Date(0);
                to = new Date(8.64e15);
                label = 'All time';
        }
        return { from, to, label };
    }

    function inPeriod(ts, from, to) {
        const d = new Date(ts);
        return d >= from && d < to;
    }

    // ============ DATA LOADERS ============
    function getOrders() { return load(K.ORDERS, []); }
    function getExpenses() { return load(K.EXPENSES, []); }
    function saveExpenses(e) { save(K.EXPENSES, e); }
    function getCosts() { return load(K.COSTS, {}); }
    function saveCosts(c) { save(K.COSTS, c); }
    function getInvoices() { return load(K.INVOICES, {}); }
    function saveInvoices(i) { save(K.INVOICES, i); }
    function getBusiness() { return load(K.BUSINESS, {}); }
    function saveBusiness(b) { save(K.BUSINESS, b); }

    /**
     * Products from DOM (static index.html) merged with admin-managed products
     * in localStorage. Returns [{id, name, price, category}, ...]
     */
    function getProducts() {
        const list = {};
        // Static DOM snapshot (works only if we're on admin page — we're not,
        // so parse the admin's cached products list, and also try fetching index).
        // For simplicity: use vaiyn_products if present; otherwise a fallback
        // derived from the Orders table (all SKUs that have appeared).
        const stored = load(K.PRODUCTS, null);
        if (Array.isArray(stored)) {
            stored.forEach(p => {
                if (p && p.id) list[p.id] = {
                    id: p.id,
                    name: p.name || p.id,
                    price: Number(p.price) || 0,
                    category: p.category || ''
                };
            });
        }
        // Fallback — derive from orders so costs table is never empty once sales exist
        getOrders().forEach(o => {
            (o.items || []).forEach(it => {
                if (!it || !it.id) return;
                if (!list[it.id]) list[it.id] = {
                    id: it.id,
                    name: it.name || it.id,
                    price: Number(it.price) || 0,
                    category: ''
                };
            });
        });
        return Object.values(list).sort((a, b) => a.name.localeCompare(b.name));
    }

    // ============ INVOICE NUMBERING ============
    /**
     * Ensures every paid-or-later order has a stable invoice number.
     * Numbers are yearly: <prefix>-<year>-<NNNN>. Returns the map.
     */
    function syncInvoices() {
        const bi = getBusiness();
        const prefix = (bi.prefix || 'CA').toUpperCase();
        const start = Number(bi.invoiceStart) || 1;

        const invoices = getInvoices();
        const orders = getOrders();
        // Group orders by year of createdAt so numbering resets annually
        const byYear = {};
        orders.forEach(o => {
            if (!countsAsRevenue(o)) return;
            if (invoices[o.number]) return; // already numbered
            const y = new Date(o.createdAt || Date.now()).getFullYear();
            (byYear[y] = byYear[y] || []).push(o);
        });
        // Compute next sequential per year
        Object.keys(byYear).forEach(year => {
            const assigned = Object.values(invoices)
                .filter(v => v && v.year === Number(year))
                .map(v => v.seq);
            let next = assigned.length ? Math.max(...assigned) + 1 : start;
            byYear[year]
                .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
                .forEach(o => {
                    invoices[o.number] = {
                        year: Number(year),
                        seq: next,
                        number: `${prefix}-${year}-${String(next).padStart(4, '0')}`,
                        issuedAt: o.createdAt || Date.now(),
                        orderNumber: o.number
                    };
                    next++;
                });
        });
        saveInvoices(invoices);
        return invoices;
    }

    // ============ OVERVIEW PANEL ============
    function computePL(from, to) {
        const orders = getOrders();
        const expenses = getExpenses();
        const costs = getCosts();

        let revenue = 0, orderCount = 0, cogs = 0;
        const byProduct = {};
        orders.forEach(o => {
            if (!countsAsRevenue(o)) return;
            if (!inPeriod(o.createdAt, from, to)) return;
            orderCount++;
            revenue += Number(o.total) || 0;
            (o.items || []).forEach(it => {
                const qty = Number(it.qty) || 1;
                const price = Number(it.price) || 0;
                const cost = (costs[it.id] && Number(costs[it.id].cost)) || 0;
                cogs += cost * qty;
                byProduct[it.id] = byProduct[it.id] || { id: it.id, name: it.name || it.id, units: 0, revenue: 0 };
                byProduct[it.id].units += qty;
                byProduct[it.id].revenue += price * qty;
            });
        });

        let expTotal = 0, expCount = 0;
        const byCat = {};
        expenses.forEach(e => {
            if (!inPeriod(e.date, from, to)) return;
            const amt = Number(e.amount) || 0;
            expTotal += amt;
            expCount++;
            byCat[e.category || 'Other'] = (byCat[e.category || 'Other'] || 0) + amt;
        });

        const gross = revenue - cogs;
        const net = gross - expTotal;

        return {
            revenue, orderCount, cogs,
            expenses: expTotal, expenseCount: expCount,
            gross, net,
            topProducts: Object.values(byProduct).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
            topCategories: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5)
        };
    }

    function renderOverview() {
        const periodKey = $('#fin-period-select').value || 'month';
        const { from, to, label } = periodRange(periodKey);
        $('#fin-period-range').textContent = label;

        const pl = computePL(from, to);
        $('#fin-revenue').textContent = fmt(pl.revenue);
        $('#fin-revenue-hint').textContent = pl.orderCount + ' order' + (pl.orderCount === 1 ? '' : 's');
        $('#fin-expenses').textContent = fmt(pl.expenses);
        $('#fin-expenses-hint').textContent = pl.expenseCount + ' entr' + (pl.expenseCount === 1 ? 'y' : 'ies');
        $('#fin-gross').textContent = fmt(pl.gross);
        $('#fin-net').textContent = fmt(pl.net);

        // Top categories
        const catBody = $('#fin-top-expenses tbody');
        if (!pl.topCategories.length) {
            catBody.innerHTML = '<tr><td class="muted">No expenses in this period.</td></tr>';
        } else {
            catBody.innerHTML = pl.topCategories.map(([c, a]) =>
                `<tr><td>${esc(c)}</td><td style="text-align:right;">${fmt(a)}</td></tr>`
            ).join('');
        }

        // Top products
        const prodBody = $('#fin-top-products tbody');
        if (!pl.topProducts.length) {
            prodBody.innerHTML = '<tr><td class="muted">No sales in this period.</td></tr>';
        } else {
            prodBody.innerHTML = pl.topProducts.map(p =>
                `<tr><td>${esc(p.name)}</td><td style="text-align:right;">${p.units}×</td><td style="text-align:right;">${fmt(p.revenue)}</td></tr>`
            ).join('');
        }
    }

    // ============ EXPENSES PANEL ============
    let expFilters = { search: '', category: '', period: 'all' };

    function renderExpenseFilters() {
        const sel = $('#fin-exp-filter-cat');
        if (sel.options.length <= 1) {
            EXPENSE_CATEGORIES.forEach(c => {
                const o = document.createElement('option');
                o.value = c; o.textContent = c;
                sel.appendChild(o);
            });
        }
    }

    function filteredExpenses() {
        let items = getExpenses().slice();
        if (expFilters.search) {
            const q = expFilters.search.toLowerCase();
            items = items.filter(e =>
                (e.description || '').toLowerCase().includes(q) ||
                (e.supplier || '').toLowerCase().includes(q)
            );
        }
        if (expFilters.category) items = items.filter(e => e.category === expFilters.category);
        if (expFilters.period !== 'all') {
            const { from, to } = periodRange(expFilters.period);
            items = items.filter(e => inPeriod(e.date, from, to));
        }
        return items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }

    function renderExpenses() {
        renderExpenseFilters();
        const tbody = $('#fin-exp-table tbody');
        const items = filteredExpenses();
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:30px;">No expenses match these filters.</td></tr>';
            return;
        }
        tbody.innerHTML = items.map(e => `
            <tr data-id="${esc(e.id)}">
                <td>${esc(fmtDateLocal(e.date))}</td>
                <td>${esc(e.category)}</td>
                <td>${esc(e.supplier || '—')}</td>
                <td>${esc(e.description || '')}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${fmt(e.amount)}</td>
                <td>
                    <button class="btn-row edit-exp">Edit</button>
                    <button class="btn-row danger del-exp">Delete</button>
                </td>
            </tr>`).join('');

        tbody.querySelectorAll('.edit-exp').forEach(b =>
            b.addEventListener('click', () => openExpenseDialog(b.closest('tr').dataset.id))
        );
        tbody.querySelectorAll('.del-exp').forEach(b =>
            b.addEventListener('click', () => {
                const id = b.closest('tr').dataset.id;
                if (!confirm('Delete this expense?')) return;
                const list = getExpenses().filter(e => e.id !== id);
                saveExpenses(list);
                renderExpenses();
                renderOverview();
            })
        );
    }

    function openExpenseDialog(editId) {
        const editing = editId ? getExpenses().find(e => e.id === editId) : null;
        const today = fmtDateISO(Date.now());
        const modal = document.createElement('div');
        modal.className = 'fin-modal';
        modal.innerHTML = `
            <div class="fin-modal-card">
                <h3>${editing ? 'Edit expense' : 'Add expense'}</h3>
                <form id="fin-exp-form">
                    <div class="fin-form-grid">
                        <label>Date
                            <input type="date" name="date" required value="${esc(editing ? editing.date : today)}">
                        </label>
                        <label>Amount (€)
                            <input type="number" name="amount" step="0.01" min="0.01" required value="${editing ? editing.amount : ''}">
                        </label>
                        <label class="fin-form-wide">Category
                            <select name="category" required>
                                ${EXPENSE_CATEGORIES.map(c =>
                                    `<option value="${esc(c)}"${editing && editing.category === c ? ' selected' : ''}>${esc(c)}</option>`
                                ).join('')}
                            </select>
                        </label>
                        <label class="fin-form-wide">Supplier
                            <input type="text" name="supplier" placeholder="e.g. La Poste, Etsy, OVH" value="${esc(editing ? editing.supplier : '')}">
                        </label>
                        <label class="fin-form-wide">Description
                            <input type="text" name="description" placeholder="e.g. 100 kraft mailer boxes" value="${esc(editing ? editing.description : '')}">
                        </label>
                    </div>
                    <div class="fin-form-actions">
                        <button type="button" class="btn-secondary" id="fin-exp-cancel">Cancel</button>
                        <button type="submit" class="btn-primary">${editing ? 'Save changes' : 'Add expense'}</button>
                    </div>
                </form>
            </div>`;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
        $('#fin-exp-cancel', modal).addEventListener('click', close);
        $('#fin-exp-form', modal).addEventListener('submit', e => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            const rec = {
                id: editing ? editing.id : uid(),
                createdAt: editing ? editing.createdAt : Date.now(),
                date: data.date,
                amount: parseFloat(data.amount),
                category: data.category,
                supplier: (data.supplier || '').trim(),
                description: (data.description || '').trim()
            };
            let list = getExpenses();
            if (editing) list = list.map(x => x.id === editing.id ? rec : x);
            else list.push(rec);
            saveExpenses(list);
            close();
            renderExpenses();
            renderOverview();
        });
    }

    function exportExpensesCSV() {
        const items = filteredExpenses();
        const rows = [['Date', 'Category', 'Supplier', 'Description', 'Amount (EUR)']];
        items.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))
            .forEach(e => rows.push([
                e.date, e.category, e.supplier || '', e.description || '',
                Number(e.amount).toFixed(2)
            ]));
        downloadBlob(
            rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n'),
            'vaiyn-expenses-' + fmtDateISO(Date.now()) + '.csv',
            'text/csv;charset=utf-8'
        );
    }

    // ============ COGS PANEL ============
    function renderCOGS() {
        const products = getProducts();
        const costs = getCosts();
        const tbody = $('#fin-cogs-table tbody');
        if (!products.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:30px;">No products yet. Add products in the Products tab first, or make a test sale.</td></tr>';
            return;
        }
        tbody.innerHTML = products.map(p => {
            const cost = (costs[p.id] && Number(costs[p.id].cost)) || 0;
            const margin = p.price - cost;
            const pct = p.price > 0 ? (margin / p.price * 100) : 0;
            const cls = margin < 0 ? 'neg' : margin === 0 ? 'muted' : 'pos';
            return `
                <tr data-id="${esc(p.id)}">
                    <td><code>${esc(p.id)}</code></td>
                    <td>${esc(p.name)}</td>
                    <td style="text-align:right;font-variant-numeric:tabular-nums;">${fmt(p.price)}</td>
                    <td style="text-align:right;">
                        <input type="number" step="0.01" min="0" value="${cost || ''}" class="cogs-input" data-sku="${esc(p.id)}" style="width:110px;text-align:right;">
                    </td>
                    <td style="text-align:right;font-variant-numeric:tabular-nums;" class="${cls}">${fmt(margin)}</td>
                    <td style="text-align:right;font-variant-numeric:tabular-nums;" class="${cls}">${pct.toFixed(0)}%</td>
                </tr>`;
        }).join('');

        tbody.querySelectorAll('.cogs-input').forEach(inp => {
            inp.addEventListener('change', () => {
                const sku = inp.dataset.sku;
                const val = parseFloat(inp.value) || 0;
                const costs = getCosts();
                costs[sku] = { cost: val, updated: Date.now() };
                saveCosts(costs);
                renderCOGS();
                renderOverview();
            });
        });
    }

    // ============ INVOICES PANEL ============
    function renderInvoices() {
        syncInvoices();
        const invoices = getInvoices();
        const orders = getOrders();
        const tbody = $('#fin-inv-table tbody');
        const paid = orders
            .filter(countsAsRevenue)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        if (!paid.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:30px;">No paid orders yet — invoices appear when an order is marked Paid / Processing / Shipped / Delivered.</td></tr>';
            return;
        }
        tbody.innerHTML = paid.map(o => {
            const inv = invoices[o.number];
            const invNumber = inv ? inv.number : '—';
            return `
                <tr>
                    <td><strong>${esc(invNumber)}</strong></td>
                    <td>#${esc(o.number)}</td>
                    <td>${esc(o.customer || '—')}</td>
                    <td>${esc(fmtDateLocal(o.createdAt))}</td>
                    <td style="text-align:right;font-variant-numeric:tabular-nums;">${fmt(o.total)}</td>
                    <td>${esc(o.status)}</td>
                    <td>
                        <button class="btn-row" data-inv-pdf="${esc(o.number)}">PDF</button>
                        <button class="btn-row" data-inv-preview="${esc(o.number)}">Preview</button>
                    </td>
                </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-inv-pdf]').forEach(b =>
            b.addEventListener('click', () => downloadInvoicePDF(b.dataset.invPdf))
        );
        tbody.querySelectorAll('[data-inv-preview]').forEach(b =>
            b.addEventListener('click', () => previewInvoice(b.dataset.invPreview))
        );
    }

    function buildInvoiceContext(orderNumber) {
        const orders = getOrders();
        const order = orders.find(o => String(o.number) === String(orderNumber));
        if (!order) return null;
        const invoices = getInvoices();
        const inv = invoices[order.number];
        const bi = getBusiness();
        return { order, invoice: inv, business: bi };
    }

    function previewInvoice(orderNumber) {
        const ctx = buildInvoiceContext(orderNumber);
        if (!ctx) return;
        const w = window.open('', '_blank', 'width=780,height=900');
        if (!w) { alert('Pop-up blocked — allow pop-ups for this site.'); return; }
        w.document.write(renderInvoiceHTML(ctx));
        w.document.close();
    }

    function renderInvoiceHTML(ctx) {
        const { order, invoice, business } = ctx;
        const bi = business || {};
        const isDraft = !invoice || !bi.name;
        const itemsRows = (order.items || []).map(it => {
            const qty = Number(it.qty) || 1;
            const price = Number(it.price) || 0;
            return `<tr>
                <td>${esc(it.name || it.id)}</td>
                <td style="text-align:center;">${qty}</td>
                <td style="text-align:right;">${fmt(price)}</td>
                <td style="text-align:right;">${fmt(price * qty)}</td>
            </tr>`;
        }).join('');
        const total = Number(order.total) || 0;
        const ship = Number(order.shippingFee) || 0;
        const subtotal = Number(order.subtotal) != null ? Number(order.subtotal) : (total - ship);
        const tvaLine = bi.tvaStatus === 'registered'
            ? '<p>TVA incluse selon taux en vigueur.</p>'
            : '<p><strong>TVA non applicable, art. 293 B du CGI.</strong></p>';
        const shipping = order.shipping || {};
        const shipAddr = [
            esc(order.customer || ''),
            esc(shipping.address1),
            esc(shipping.address2),
            `${esc(shipping.postalCode || '')} ${esc(shipping.city || '')}`,
            esc(shipping.country)
        ].filter(Boolean).join('<br>');

        return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${esc((invoice && invoice.number) || 'DRAFT')} — ${esc(bi.name || 'VAIYN')}</title>
<style>
    body { font-family: 'Helvetica', 'Arial', sans-serif; color:#0a0a0a; margin: 0; padding: 40px 50px; background:#fff; font-size: 13px; }
    h1 { font-family: 'Cormorant Garamond', 'Didot', Georgia, serif; font-weight: 400; font-size: 28px; margin: 0 0 6px; letter-spacing: 0.08em; }
    .muted { color: #888; font-size: 11px; }
    .brand { text-align:right; }
    .head { display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .panels { display: flex; gap: 40px; margin-bottom: 30px; }
    .panel { flex: 1; }
    .label { text-transform: uppercase; letter-spacing: 0.18em; font-size: 10px; color: #888; margin-bottom: 6px; }
    table { width:100%; border-collapse: collapse; margin: 0 0 14px; font-size: 13px; }
    th { text-align: left; border-bottom: 1px solid #111; padding: 10px 6px; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 600; }
    td { padding: 10px 6px; border-bottom: 1px solid #eee; }
    .totals { margin-left: auto; width: 300px; }
    .totals tr td { border-bottom: none; padding: 4px 6px; }
    .totals .grand td { border-top: 1px solid #111; padding-top: 12px; font-weight: 600; font-size: 15px; }
    .draft-banner { background:#f7e6b6; color:#6b5210; padding: 10px 14px; margin: -40px -50px 30px; text-align:center; letter-spacing: 0.2em; text-transform: uppercase; font-size: 11px; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; font-size: 10px; color: #888; line-height: 1.6; }
    code { font-family: 'Courier New', monospace; }
</style>
</head>
<body>
    ${isDraft ? '<div class="draft-banner">DRAFT — Fill in Business info to finalize</div>' : ''}
    <div class="head">
        <div>
            <h1>FACTURE</h1>
            <p class="muted">Invoice</p>
            <p style="margin-top:14px;"><strong>${esc((invoice && invoice.number) || 'DRAFT')}</strong></p>
            <p class="muted">Order #${esc(order.number)}</p>
            <p class="muted">Date: ${esc(fmtDateLocal(order.createdAt))}</p>
        </div>
        <div class="brand">
            <h1>${esc(bi.name || 'VAIYN')}</h1>
            <p class="muted">${esc(bi.address || '')}</p>
            ${bi.siren ? `<p class="muted">SIREN: ${esc(bi.siren)}</p>` : ''}
            ${bi.tvaNumber ? `<p class="muted">TVA: ${esc(bi.tvaNumber)}</p>` : ''}
        </div>
    </div>

    <div class="panels">
        <div class="panel">
            <div class="label">Billed to</div>
            <p>${shipAddr || '—'}</p>
            ${order.email ? `<p class="muted">${esc(order.email)}</p>` : ''}
        </div>
        <div class="panel">
            <div class="label">Payment terms</div>
            <p>${Number(bi.terms) > 0 ? `Payable sous ${Number(bi.terms)} jours` : 'Payable à réception'}</p>
            ${bi.iban ? `<p class="muted">IBAN: <code>${esc(bi.iban)}</code></p>` : ''}
            ${bi.bic ? `<p class="muted">BIC: <code>${esc(bi.bic)}</code></p>` : ''}
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th style="text-align:center;width:60px;">Qty</th>
                <th style="text-align:right;width:110px;">Unit</th>
                <th style="text-align:right;width:110px;">Total</th>
            </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
    </table>

    <table class="totals">
        <tr><td>Subtotal</td><td style="text-align:right;">${fmt(subtotal)}</td></tr>
        <tr><td>Shipping</td><td style="text-align:right;">${ship === 0 ? 'Free' : fmt(ship)}</td></tr>
        <tr class="grand"><td>Total TTC</td><td style="text-align:right;">${fmt(total)}</td></tr>
    </table>

    <div class="footer">
        ${tvaLine}
        ${bi.ape ? `<p>Code APE: ${esc(bi.ape)}</p>` : ''}
        <p>En cas de retard de paiement, pénalité au taux de 3 fois le taux d'intérêt légal, indemnité forfaitaire de recouvrement de 40€ (art. L441-10 C. com.).</p>
        <p style="margin-top:12px;">Thank you for your order.</p>
    </div>
</body></html>`;
    }

    function downloadInvoicePDF(orderNumber) {
        const ctx = buildInvoiceContext(orderNumber);
        if (!ctx) return;
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert('PDF engine not loaded yet — try again in a moment.');
            return;
        }
        const { jsPDF } = window.jspdf;
        const html = renderInvoiceHTML(ctx);
        // Render via offscreen iframe so jsPDF can capture it
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:780px;height:1100px;border:0;';
        document.body.appendChild(iframe);
        iframe.srcdoc = html;
        iframe.onload = function () {
            try {
                const doc = new jsPDF({ unit: 'pt', format: 'a4' });
                doc.html(iframe.contentDocument.body, {
                    callback: function (pdf) {
                        const name = ((ctx.invoice && ctx.invoice.number) || 'draft') + '.pdf';
                        pdf.save(name);
                        iframe.remove();
                    },
                    x: 0, y: 0,
                    width: 555,
                    windowWidth: 780
                });
            } catch (e) {
                iframe.remove();
                alert('PDF generation failed: ' + e.message + '\n\nFalling back to preview — use browser "Print to PDF".');
                previewInvoice(orderNumber);
            }
        };
    }

    // ============ LIVRE DE RECETTES PANEL ============
    function renderLivre() {
        syncInvoices();
        const invoices = getInvoices();
        const orders = getOrders()
            .filter(countsAsRevenue)
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        const tbody = $('#fin-livre-table tbody');
        if (!orders.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:30px;">No paid orders yet.</td></tr>';
            return;
        }
        tbody.innerHTML = orders.map((o, i) => {
            const inv = invoices[o.number];
            return `
                <tr>
                    <td>${i + 1}</td>
                    <td>${esc(fmtDateLocal(o.createdAt))}</td>
                    <td>${esc(inv ? inv.number : '—')}</td>
                    <td>${esc(o.customer || '—')}</td>
                    <td>${esc(o.paymentMethod || 'Card')}</td>
                    <td style="text-align:right;font-variant-numeric:tabular-nums;">${fmt(o.total)}</td>
                </tr>`;
        }).join('');
    }

    function exportLivreCSV() {
        syncInvoices();
        const invoices = getInvoices();
        const orders = getOrders()
            .filter(countsAsRevenue)
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        const rows = [['Line', 'Date', 'Invoice #', 'Customer', 'Payment method', 'Amount TTC (EUR)']];
        orders.forEach((o, i) => {
            const inv = invoices[o.number];
            rows.push([
                i + 1,
                fmtDateISO(o.createdAt),
                inv ? inv.number : '',
                o.customer || '',
                o.paymentMethod || 'Card',
                Number(o.total).toFixed(2)
            ]);
        });
        downloadBlob(
            rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n'),
            'livre-de-recettes-' + fmtDateISO(Date.now()) + '.csv',
            'text/csv;charset=utf-8'
        );
    }

    function exportURSSAFQuarter() {
        const qRange = periodRange('last-quarter');
        const orders = getOrders()
            .filter(countsAsRevenue)
            .filter(o => inPeriod(o.createdAt, qRange.from, qRange.to));
        const revenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const bi = getBusiness();
        const blob = [
            'VAIYN — URSSAF declaration draft',
            'Period: ' + qRange.label,
            'Company: ' + (bi.name || '—'),
            'SIREN: ' + (bi.siren || '—'),
            'Legal form: ' + (bi.form || '—'),
            '',
            'Turnover (chiffre d\'affaires encaissé): ' + revenue.toFixed(2) + ' €',
            'Number of orders: ' + orders.length,
            '',
            'Categorisation (enter on URSSAF portal):',
            '  Micro-BIC vente de marchandises: ' + revenue.toFixed(2) + ' €',
            '',
            'NOTE: This is a draft to help you file. File the actual declaration at autoentrepreneur.urssaf.fr',
            ''
        ].join('\n');
        downloadBlob(blob, 'urssaf-draft-' + fmtDateISO(Date.now()) + '.txt', 'text/plain;charset=utf-8');
    }

    // ============ BUSINESS INFO PANEL ============
    function loadBusinessIntoForm() {
        const bi = getBusiness();
        $('#bi-name').value = bi.name || '';
        $('#bi-form').value = bi.form || '';
        $('#bi-siren').value = bi.siren || '';
        $('#bi-ape').value = bi.ape || '';
        $('#bi-address').value = bi.address || '';
        $('#bi-tva-status').value = bi.tvaStatus || 'franchise';
        $('#bi-tva-number').value = bi.tvaNumber || '';
        $('#bi-iban').value = bi.iban || '';
        $('#bi-bic').value = bi.bic || '';
        $('#bi-prefix').value = bi.prefix || 'CA';
        $('#bi-start').value = bi.invoiceStart || 1;
        $('#bi-terms').value = bi.terms != null ? bi.terms : 0;
    }

    function saveBusinessFromForm(e) {
        e.preventDefault();
        const bi = {
            name: $('#bi-name').value.trim(),
            form: $('#bi-form').value,
            siren: $('#bi-siren').value.trim(),
            ape: $('#bi-ape').value.trim(),
            address: $('#bi-address').value.trim(),
            tvaStatus: $('#bi-tva-status').value,
            tvaNumber: $('#bi-tva-number').value.trim(),
            iban: $('#bi-iban').value.trim(),
            bic: $('#bi-bic').value.trim(),
            prefix: ($('#bi-prefix').value.trim() || 'CA').toUpperCase(),
            invoiceStart: Math.max(1, parseInt($('#bi-start').value, 10) || 1),
            terms: Math.max(0, parseInt($('#bi-terms').value, 10) || 0),
            updatedAt: Date.now()
        };
        saveBusiness(bi);
        const btn = e.target.querySelector('button[type="submit"]');
        const prev = btn.textContent;
        btn.textContent = 'Saved ✓';
        btn.disabled = true;
        setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1400);
    }

    // ============ UTIL: DOWNLOAD ============
    function downloadBlob(content, filename, type) {
        const blob = new Blob([content], { type: type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 500);
    }

    // ============ TAB SWITCHING ============
    function switchFinTab(key) {
        $$('.fin-tab').forEach(t => t.classList.toggle('active', t.dataset.finTab === key));
        $$('.fin-panel').forEach(p => p.classList.toggle('active', p.dataset.finPanel === key));
        switch (key) {
            case 'overview':  renderOverview(); break;
            case 'expenses':  renderExpenses(); break;
            case 'cogs':      renderCOGS(); break;
            case 'invoices':  renderInvoices(); break;
            case 'livre':     renderLivre(); break;
            case 'business':  loadBusinessIntoForm(); break;
        }
    }

    // ============ INIT ============
    function init() {
        if (!document.querySelector('[data-view="finance"]')) return;

        // Sub-tab clicks
        $$('.fin-tab').forEach(t => {
            t.addEventListener('click', () => switchFinTab(t.dataset.finTab));
        });

        // Overview controls
        const periodSel = $('#fin-period-select');
        if (periodSel) periodSel.addEventListener('change', renderOverview);

        // Expenses controls
        $('#fin-exp-add').addEventListener('click', () => openExpenseDialog(null));
        $('#fin-exp-export').addEventListener('click', exportExpensesCSV);
        $('#fin-exp-search').addEventListener('input', e => {
            expFilters.search = e.target.value.trim();
            renderExpenses();
        });
        $('#fin-exp-filter-cat').addEventListener('change', e => {
            expFilters.category = e.target.value;
            renderExpenses();
        });
        $('#fin-exp-filter-period').addEventListener('change', e => {
            expFilters.period = e.target.value;
            renderExpenses();
        });

        // Livre controls
        $('#fin-livre-export-csv').addEventListener('click', exportLivreCSV);
        $('#fin-livre-export-urssaf').addEventListener('click', exportURSSAFQuarter);

        // Business form
        $('#fin-business-form').addEventListener('submit', saveBusinessFromForm);

        // Listen for sidebar nav → Finance → render Overview
        document.querySelectorAll('.sb-link[data-view="finance"]').forEach(btn => {
            btn.addEventListener('click', () => {
                setTimeout(() => switchFinTab('overview'), 50);
            });
        });

        // Expose for console debugging
        window.__vaiynFinance = {
            renderOverview, renderExpenses, renderCOGS, renderInvoices, renderLivre,
            syncInvoices, getBusiness, getExpenses, getCosts
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
