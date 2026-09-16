const STORAGE_KEY = 'gathered-pool-v2';

const initialPool = {
	title: 'Shared gift pool',
	targetCents: 0,
	participants: [],
	transactions: []
};

function clonePool(pool) {
	return JSON.parse(JSON.stringify(pool));
}

export function loadPool() {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		const pool = saved ? { ...clonePool(initialPool), ...JSON.parse(saved) } : clonePool(initialPool);
		return { ...pool, transactions: Array.isArray(pool.transactions) ? pool.transactions : [] };
	} catch {
		return clonePool(initialPool);
	}
}

export function savePool(pool) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(pool));
}

export function createEmptyPool(title = 'Shared gift pool', targetCents = 0) {
	return { title, targetCents, participants: [], transactions: [] };
}
