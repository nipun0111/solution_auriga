import { calculatePool, toCents } from './calculations.js';
import { createEmptyPool, loadPool, savePool } from './storage.js';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const state = { pool: loadPool(), editingId: null, transactionsExpanded: false };
const palette = ['avatar-sage', 'avatar-coral', 'avatar-blue', 'avatar-yellow', 'avatar-lilac', 'avatar-mint'];

const elements = {
	title: document.querySelector('.hero-section h1'),
	peopleList: document.querySelector('#people-list'),
	settlementList: document.querySelector('#settlement-list'),
	settlementDescription: document.querySelector('#settlement-description'),
	modal: document.querySelector('#person-modal'),
	form: document.querySelector('#person-form'),
	nameInput: document.querySelector('#person-name'),
	paidInput: document.querySelector('#person-paid'),
	paidLabel: document.querySelector('#person-paid-label'),
	formError: document.querySelector('#person-form-error'),
	modalTitle: document.querySelector('#person-modal-title'),
	poolModal: document.querySelector('#pool-modal'),
	poolForm: document.querySelector('#pool-form'),
	poolTitleInput: document.querySelector('#pool-title'),
	poolTargetInput: document.querySelector('#pool-target'),
	poolFormError: document.querySelector('#pool-form-error'),
	toast: document.querySelector('#toast'),
	note: document.querySelector('#pool-note')
};

function formatMoney(cents) {
	return currency.format(cents / 100);
}

function escapeHtml(value) {
	return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function initials(name) {
	return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function statusLabel(status) {
	return { paid: 'Paid', partial: 'Part-paid', extra: 'Paid extra', unpaid: 'Not paid' }[status];
}

function renderSummary(view) {
	const targetLabel = document.querySelector('#target-label');
	const collectedAmount = document.querySelector('#collected-amount');
	const progressBar = document.querySelector('#progress-bar');
	const progressTrack = document.querySelector('#progress-track');
	const progressLabel = document.querySelector('#progress-label');
	const collectionStatus = document.querySelector('#collection-status');
	const neededAmount = document.querySelector('#needed-amount');
	const neededPeople = document.querySelector('#needed-people');
	const neededStatus = document.querySelector('#needed-status');
	const shareAmount = document.querySelector('#share-amount');
	const contributorCount = document.querySelector('#contributor-count');
	const peopleCount = document.querySelector('#people-count');
	targetLabel.textContent = `of ${formatMoney(view.targetCents)}`;
	collectedAmount.textContent = formatMoney(view.collectedCents);
	progressBar.style.width = `${Math.min(view.percentCollected, 100)}%`;
	progressTrack.setAttribute('aria-label', `${view.percentCollected}% collected`);
	progressLabel.textContent = `${view.percentCollected}% of target`;
	collectionStatus.textContent = !view.targetCents ? 'No pool yet' : view.collectedCents >= view.targetCents ? 'Complete' : 'On track';
	neededAmount.textContent = formatMoney(view.outstandingCents);
	neededPeople.textContent = `From ${view.participants.filter((person) => person.balanceCents > 0).length} people`;
	neededStatus.textContent = !view.targetCents ? 'No pool yet' : view.outstandingCents ? 'To collect' : 'All collected';
	shareAmount.textContent = view.participants.length ? formatMoney(Math.round(view.targetCents / view.participants.length)) : formatMoney(view.targetCents);
	contributorCount.textContent = `${view.participants.length} contributor${view.participants.length === 1 ? '' : 's'}`;
	peopleCount.textContent = view.participants.length;
}

function renderPeople(view) {
	const head = '<div class="table-head" role="row"><span role="columnheader">Person</span><span role="columnheader">Fair share</span><span role="columnheader">Paid</span><span role="columnheader">Balance</span><span role="columnheader">Status</span><span></span></div>';
	const rows = view.participants.map((person, index) => {
		const balanceText = person.balanceCents > 0 ? `${formatMoney(person.balanceCents)} due` : person.balanceCents < 0 ? `${formatMoney(-person.balanceCents)} back` : formatMoney(0);
		const balanceClass = person.balanceCents > 0 ? 'balance-due' : person.balanceCents < 0 ? 'balance-credit' : 'balance-settled';
		const paidDate = 'In this pool';
		return `<div class="person-row" role="row"><div class="person-cell" role="cell"><span class="avatar ${palette[index % palette.length]}">${escapeHtml(initials(person.name))}</span><span><strong>${escapeHtml(person.name)}</strong><small>${paidDate}</small></span></div><span class="amount-cell" role="cell">${formatMoney(person.fairShareCents)}</span><span class="amount-cell" role="cell">${formatMoney(person.paidCents)}</span><span class="amount-cell ${balanceClass}" role="cell">${balanceText}</span><span class="status status-${person.status}" role="cell">${statusLabel(person.status)}</span><button class="row-menu" type="button" data-action="edit-person" data-id="${escapeHtml(person.id)}" aria-label="Edit ${escapeHtml(person.name)}">•••</button></div>`;
	}).join('');
	elements.peopleList.innerHTML = head + (rows || '<div class="empty-state">Add people to start tracking the pool.</div>');
}

function renderTransactions(view) {
	const transactions = Array.isArray(state.pool.transactions) ? state.pool.transactions : [];
	const visibleTransactions = state.transactionsExpanded ? [...transactions].reverse() : transactions.slice(-5).reverse();
	elements.settlementDescription.textContent = transactions.length ? `${transactions.length} payment${transactions.length === 1 ? '' : 's'} recorded.` : 'Payments made to this pool will appear here.';
	if (!transactions.length) {
		elements.settlementList.innerHTML = '<div class="empty-state">No payments yet.</div>';
		return;
	}
	const transactionRows = visibleTransactions.map((transaction) => `<div class="settlement-item settlement-item-log settlement-item-complete"><div class="settlement-people"><strong>${escapeHtml(transaction.from)}</strong><span>paid to pool</span></div><strong class="settlement-amount">${formatMoney(transaction.amountCents)}</strong><span class="settlement-complete">Paid</span></div>`).join('');
	const toggle = transactions.length > 5 ? `<button class="transaction-toggle" type="button" data-action="toggle-transactions" aria-expanded="${state.transactionsExpanded}" aria-label="${state.transactionsExpanded ? 'Show five recent payments' : 'Show all payments'}">${state.transactionsExpanded ? '&#8593;' : '&#8595;'}</button>` : '';
	elements.settlementList.innerHTML = transactionRows + toggle;
}

function render() {
	const view = calculatePool(state.pool);
	elements.title.textContent = view.title;
	renderSummary(view);
	renderPeople(view);
	renderTransactions(view);
	const poolNoteText = document.querySelector('#pool-note-text');
	if (poolNoteText) {
		if (view.creditCents) poolNoteText.innerHTML = `<strong>Pool health:</strong> ${escapeHtml(view.participants.find((person) => person.balanceCents < 0)?.name || 'A contributor')} has paid extra and should receive ${formatMoney(view.creditCents)} back.`;
		else poolNoteText.innerHTML = '<strong>Pool health:</strong> Everyone\'s contribution is accounted for in the current balance.';
	}
}

function showToast(message) {
	elements.toast.textContent = message;
	elements.toast.classList.add('is-visible');
	window.setTimeout(() => elements.toast.classList.remove('is-visible'), 2400);
}

function openPersonModal(id = null) {
	state.editingId = id;
	const person = state.pool.participants.find((item) => item.id === id);
	elements.modalTitle.textContent = person ? 'Edit person' : 'Add person';
	elements.nameInput.value = person?.name || '';
	elements.paidLabel.textContent = person ? 'New payment amount' : 'Already paid';
	elements.paidInput.value = '0';
	elements.formError.textContent = '';
	elements.modal.hidden = false;
	elements.nameInput.focus();
}

function closePersonModal() {
	elements.modal.hidden = true;
	state.editingId = null;
}

function handlePersonSubmit(event) {
	event.preventDefault();
	const name = elements.nameInput.value.trim();
	const paidCents = toCents(elements.paidInput.value);
	const duplicate = state.pool.participants.some((person) => person.name.toLowerCase() === name.toLowerCase() && person.id !== state.editingId);
	if (!name) { elements.formError.textContent = 'Add a name to continue.'; return; }
	if (duplicate) { elements.formError.textContent = 'That person is already in this pool.'; return; }
	if (state.editingId) {
		const person = state.pool.participants.find((item) => item.id === state.editingId);
		const previousPaidCents = Number.isFinite(person.paidCents) ? person.paidCents : 0;
		const addedPaymentCents = paidCents;
		person.name = name;
		person.paidCents = previousPaidCents + addedPaymentCents;
		if (addedPaymentCents > 0) addTransaction(name, addedPaymentCents);
	} else {
		state.pool.participants.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, name, paidCents });
		if (paidCents > 0) addTransaction(name, paidCents);
	}
	savePool(state.pool);
	closePersonModal();
	render();
	showToast(`${name} was saved to the pool.`);
}

function openPoolModal() {
	elements.poolTitleInput.value = state.pool.title || 'Shared gift pool';
	elements.poolTargetInput.value = state.pool.targetCents ? (state.pool.targetCents / 100).toFixed(2) : '6000';
	elements.poolFormError.textContent = '';
	elements.poolModal.hidden = false;
	elements.poolTitleInput.focus();
}

function closePoolModal() {
	elements.poolModal.hidden = true;
}

function handlePoolSubmit(event) {
	event.preventDefault();
	const title = elements.poolTitleInput.value.trim();
	const targetCents = toCents(elements.poolTargetInput.value);
	if (!title) { elements.poolFormError.textContent = 'Add a name to continue.'; return; }
	if (!targetCents) { elements.poolFormError.textContent = 'Enter a target amount greater than zero.'; return; }
	state.pool = createEmptyPool(title, targetCents);
	savePool(state.pool);
	closePoolModal();
	render();
	showToast('New pool created.');
}

function addTransaction(name, amountCents) {
	if (!Array.isArray(state.pool.transactions)) state.pool.transactions = [];
	state.pool.transactions.push({
		id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
		from: name,
		amountCents,
		createdAt: new Date().toISOString()
	});
}

document.addEventListener('click', (event) => {
	const actionTarget = event.target.closest('[data-action]');
	if (!actionTarget) return;
	const { action, id } = actionTarget.dataset;
	if (action === 'add-person') openPersonModal();
	if (action === 'edit-person') openPersonModal(id);
	if (action === 'close-person-modal') closePersonModal();
	if (action === 'new-pool') openPoolModal();
	if (action === 'close-pool-modal') closePoolModal();
	if (action === 'toggle-transactions') {
		state.transactionsExpanded = !state.transactionsExpanded;
		render();
	}
	if (action === 'dismiss-note') elements.note.hidden = true;
});

elements.form.addEventListener('submit', handlePersonSubmit);
elements.modal.addEventListener('click', (event) => { if (event.target === elements.modal) closePersonModal(); });
elements.poolForm.addEventListener('submit', handlePoolSubmit);
elements.poolModal.addEventListener('click', (event) => { if (event.target === elements.poolModal) closePoolModal(); });
render();
