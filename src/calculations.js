export function toCents(value) {
	const amount = Number(value);
	return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
}

export function fromCents(cents) {
	return Math.max(0, Math.round(cents));
}

export function calculatePool(pool) {
	const participants = Array.isArray(pool.participants) ? pool.participants : [];
	const targetCents = fromCents(pool.targetCents);
	const baseShare = participants.length ? Math.floor(targetCents / participants.length) : 0;
	let remainder = participants.length ? targetCents % participants.length : 0;
	const people = participants.map((participant) => {
		const paidCents = fromCents(participant.paidCents);
		const fairShareCents = baseShare + (remainder-- > 0 ? 1 : 0);
		const balanceCents = fairShareCents - paidCents;
		let status = 'paid';
		if (balanceCents > 0 && paidCents === 0) status = 'unpaid';
		else if (balanceCents > 0) status = 'partial';
		else if (balanceCents < 0) status = 'extra';
		return { ...participant, paidCents, fairShareCents, balanceCents, status };
	});
	const collectedCents = people.reduce((total, person) => total + person.paidCents, 0);
	const outstandingCents = people.length ? people.reduce((total, person) => total + Math.max(person.balanceCents, 0), 0) : targetCents;
	const creditCents = people.reduce((total, person) => total + Math.max(-person.balanceCents, 0), 0);
	return {
		...pool,
		targetCents,
		participants: people,
		collectedCents,
		outstandingCents,
		creditCents,
		percentCollected: targetCents ? Math.round((collectedCents / targetCents) * 100) : 0
	};
}
