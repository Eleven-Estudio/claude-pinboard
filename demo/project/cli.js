// Try an order by hand: node cli.js latte:2 croissant:1 --code SAVE10
import { applyCode, subtotal } from './checkout.js'

const args = process.argv.slice(2)
const codeAt = args.indexOf('--code')
const code = codeAt === -1 ? undefined : args[codeAt + 1]
const items = args
  .filter((arg, i) => arg.includes(':') && i !== codeAt + 1)
  .map(arg => {
    const [name, qty] = arg.split(':')
    return { name, qty: Number(qty) }
  })

const before = subtotal(items)
const after = applyCode(before, code)

console.log(`Subtotal: $${before.toFixed(2)}`)
if (code !== undefined) console.log(`Code ${code}: $${after.toFixed(2)}`)
