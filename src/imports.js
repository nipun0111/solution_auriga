function normalizeText(value) {
	return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function normalizeName(value) {
	return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function displayName(value) {
	return normalizeText(value).replace(/\s+/g, ' ');
}

export function parseAmount(value) {
	const raw = String(value || '').trim();
	if (!raw) return { amountCents: 0, error: 'Missing amount' };
	if (/^-|\(.*\)/.test(raw)) return { amountCents: 0, error: 'Amount cannot be negative' };
	const cleaned = raw.replace(/^(₹|rs\.?|inr)\s*/i, '').replace(/[\s,]/g, '');
	if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { amountCents: 0, error: `Invalid amount: "${raw}"` };
	const amountCents = Math.round(Number(cleaned) * 100);
	if (!Number.isFinite(amountCents) || amountCents <= 0) return { amountCents: 0, error: 'Amount must be greater than zero' };
	return { amountCents, error: '' };
}

export function parseCsv(text) {
	const rows = [];
	let row = [];
	let cell = '';
	let quoted = false;
	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		const nextCharacter = text[index + 1];
		if (character === '"' && quoted && nextCharacter === '"') {
			cell += '"';
			index += 1;
		} else if (character === '"') {
			quoted = !quoted;
		} else if (character === ',' && !quoted) {
			row.push(cell);
			cell = '';
		} else if ((character === '\n' || character === '\r') && !quoted) {
			if (character === '\r' && nextCharacter === '\n') index += 1;
			row.push(cell);
			if (row.some((value) => value.trim())) rows.push(row);
			row = [];
			cell = '';
		} else {
			cell += character;
		}
	}
	if (quoted) return { rows: [], error: 'Unclosed quote in CSV file' };
	if (cell || row.length) {
		row.push(cell);
		if (row.some((value) => value.trim())) rows.push(row);
	}
	return { rows, error: '' };
}

function findColumn(headers, names, fallback) {
	const index = headers.findIndex((header) => names.includes(normalizeName(header)));
	return index === -1 ? fallback : index;
}

function getHeaders(rows) {
	const firstRow = rows[0] || [];
	const normalized = firstRow.map(normalizeName);
	const hasNameHeader = normalized.some((header) => ['name', 'person', 'contributor', 'member'].includes(header));
	const hasAmountHeader = normalized.some((header) => ['amount', 'paid', 'payment', 'contribution'].includes(header));
	return hasNameHeader && hasAmountHeader ? firstRow : null;
}

function fingerprint(name, amountCents, date = '', reference = '') {
	return [normalizeName(name), amountCents, String(date).trim(), String(reference).trim().toLowerCase()].join('|');
}

export function analyzeCsv(text, participants = [], transactions = []) {
	const parsed = parseCsv(text);
	if (parsed.error) return { rows: [], accepted: [], rejected: [{ rowNumber: 0, original: text, reason: parsed.error }], duplicates: [], merged: [], error: parsed.error };
	if (!parsed.rows.length) return { rows: [], accepted: [], rejected: [{ rowNumber: 0, original: '', reason: 'CSV file is empty' }], duplicates: [], merged: [], error: 'CSV file is empty' };

	const headers = getHeaders(parsed.rows);
	const dataRows = headers ? parsed.rows.slice(1) : parsed.rows;
	const nameIndex = headers ? findColumn(headers, ['name', 'person', 'contributor', 'member'], 0) : 0;
	const amountIndex = headers ? findColumn(headers, ['amount', 'paid', 'payment', 'contribution'], 1) : 1;
	const dateIndex = headers ? findColumn(headers, ['date', 'paid date', 'payment date'], -1) : 2;
	const referenceIndex = headers ? findColumn(headers, ['reference', 'note', 'description'], -1) : 3;
	const existingKeys = new Set(transactions.map((transaction) => fingerprint(transaction.from || transaction.personName, transaction.amountCents, transaction.date, transaction.reference)));
	const seenKeys = new Set(existingKeys);
	const existingNames = new Map(participants.map((participant) => [normalizeName(participant.name), participant.name]));
	const accepted = [];
	const rejected = [];
	const duplicates = [];
	const merged = [];
	const rows = [];

	dataRows.forEach((values, index) => {
		const rowNumber = headers ? index + 2 : index + 1;
		const original = values.join(',');
		const name = displayName(values[nameIndex]);
		const normalized = normalizeName(name);
		const amount = parseAmount(values[amountIndex]);
		const date = dateIndex >= 0 ? String(values[dateIndex] || '').trim() : '';
		const reference = referenceIndex >= 0 ? String(values[referenceIndex] || '').trim() : '';
		if (!name) {
			const result = { rowNumber, original, reason: 'Missing person name' };
			rejected.push(result);
			rows.push({ ...result, status: 'rejected' });
			return;
		}
		if (amount.error) {
			const result = { rowNumber, original, reason: amount.error };
			rejected.push(result);
			rows.push({ ...result, status: 'rejected' });
			return;
		}
		const key = fingerprint(name, amount.amountCents, date, reference);
		if (seenKeys.has(key)) {
			const result = { rowNumber, original, reason: 'Duplicate contribution' };
			duplicates.push(result);
			rows.push({ ...result, status: 'duplicate' });
			return;
		}
		seenKeys.add(key);
		const canonicalName = existingNames.get(normalized) || name;
		const mergedName = canonicalName !== name;
		const contribution = { rowNumber, original, name: canonicalName, normalizedName: normalized, amountCents: amount.amountCents, date, reference };
		accepted.push(contribution);
		if (mergedName) merged.push({ rowNumber, original, from: name, to: canonicalName });
		rows.push({ ...contribution, from: mergedName ? name : '', to: mergedName ? canonicalName : '', status: mergedName ? 'merged' : 'imported' });
	});
	return { rows, accepted, rejected, duplicates, merged, error: '' };
}

export function importContributions(pool, report) {
	if (!Array.isArray(pool.transactions)) pool.transactions = [];
	if (!Array.isArray(pool.participants)) pool.participants = [];
	const participantByName = new Map(pool.participants.map((participant) => [normalizeName(participant.name), participant]));
	report.accepted.forEach((contribution) => {
		let participant = participantByName.get(contribution.normalizedName);
		if (!participant) {
			participant = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, name: contribution.name, paidCents: 0 };
			pool.participants.push(participant);
			participantByName.set(contribution.normalizedName, participant);
		}
		participant.paidCents = Number(participant.paidCents) || 0;
		participant.paidCents += contribution.amountCents;
		pool.transactions.push({
			id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
			from: participant.name,
			personId: participant.id,
			amountCents: contribution.amountCents,
			date: contribution.date,
			reference: contribution.reference,
			source: 'import',
			originalRow: contribution.original,
			createdAt: contribution.date || new Date().toISOString()
		});
	});
}
