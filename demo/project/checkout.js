// Corner Coffee checkout: order totals with discount codes.

const PRICES = { espresso: 2.5, latte: 3.75, croissant: 2.25 }

// Percent off per code.
const CODES = { SAVE10: 10, WELCOME5: 5 }

export function subtotal(items) {
  return round(items.reduce((sum, { name, qty }) => sum + priceOf(name) * qty, 0))
}

export function applyCode(total, code) {
  const percent = CODES[String(code ?? '').toUpperCase()]
  if (percent === undefined) return total

  return round(total - total * (percent / 10))
}

function priceOf(name) {
  const price = PRICES[name]
  if (price === undefined) throw new Error(`Unknown item: ${name}`)

  return price
}

function round(amount) {
  return Math.round(amount * 100) / 100
}
