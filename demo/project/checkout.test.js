import assert from 'node:assert/strict'
import { test } from 'node:test'

import { applyCode, subtotal } from './checkout.js'

test('subtotal adds up the items', () => {
  assert.equal(subtotal([{ name: 'latte', qty: 2 }, { name: 'croissant', qty: 1 }]), 9.75)
})

test('an unknown code leaves the total alone', () => {
  assert.equal(applyCode(20, 'FREEBIE'), 20)
})

test('SAVE10 takes 10% off', () => {
  assert.equal(applyCode(20, 'SAVE10'), 18)
})

test('codes are case-insensitive', () => {
  assert.equal(applyCode(20, 'welcome5'), 19)
})
