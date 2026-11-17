import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {checkCase} from '../packages/qcu-accounting-suite/scripts/check-case.mjs'
test('synthetic classroom ledger and all statement relationships match the reference',async()=>{
 const data=JSON.parse(await readFile(new URL('../packages/qcu-accounting-suite/references/case.json',import.meta.url)));assert.equal(checkCase(data).assets,12500)
 const bad=structuredClone(data);bad.transactions[1].entries[1].credit=300;assert.throws(()=>checkCase(bad),/unbalanced/)
 const balancedButWrong=structuredClone(data);balancedButWrong.transactions[5].entries[0].account='管理费用';assert.throws(()=>checkCase(balancedButWrong),'a balanced but misclassified entry must not match the reference')
})
