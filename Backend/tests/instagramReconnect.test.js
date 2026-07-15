const test = require('node:test');
const assert = require('node:assert/strict');
const { compareAccountsByLinkedOrder } = require('../utils/accountAccess');

test('compareAccountsByLinkedOrder sorts by linked_at ascending', () => {
    const acc1 = { $id: 'acc1', linked_at: '2026-01-01T00:00:00.000Z' };
    const acc2 = { $id: 'acc2', linked_at: '2026-01-02T00:00:00.000Z' };
    const acc3 = { $id: 'acc3', linked_at: '2026-01-03T00:00:00.000Z' };

    const accounts = [acc3, acc1, acc2];
    accounts.sort(compareAccountsByLinkedOrder);

    assert.deepEqual(accounts, [acc1, acc2, acc3]);
});

test('compareAccountsByLinkedOrder preserves order when linked_at is unchanged', () => {
    const acc1 = { $id: 'acc1', linked_at: '2026-01-01T00:00:00.000Z' };
    const acc2 = { $id: 'acc2', linked_at: '2026-01-02T00:00:00.000Z' };
    
    // Simulate reconnection preserving linked_at
    const reconnectedAcc2 = { $id: 'acc2', linked_at: '2026-01-02T00:00:00.000Z', status: 'active' };

    const accountsBefore = [acc1, acc2];
    const accountsAfter = [acc1, reconnectedAcc2];

    accountsBefore.sort(compareAccountsByLinkedOrder);
    accountsAfter.sort(compareAccountsByLinkedOrder);

    assert.equal(accountsBefore[0].$id, 'acc1');
    assert.equal(accountsBefore[1].$id, 'acc2');
    assert.equal(accountsAfter[0].$id, 'acc1');
    assert.equal(accountsAfter[1].$id, 'acc2');
});

test('compareAccountsByLinkedOrder falls back to ID comparison when linked_at is missing or identical', () => {
    const acc1 = { $id: 'acc1', linked_at: '2026-01-01T00:00:00.000Z' };
    const acc2 = { $id: 'acc2', linked_at: '2026-01-01T00:00:00.000Z' };

    const accounts = [acc2, acc1];
    accounts.sort(compareAccountsByLinkedOrder);

    assert.deepEqual(accounts, [acc1, acc2]);
});
