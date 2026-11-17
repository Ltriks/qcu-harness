// Only reads the packaged synthetic case. No network, writes, eval, or user-file arguments.
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
export function checkCase(data){
 assert.equal(data.synthetic,true)
 const balances={},cashFlows={operating:0,investing:0,financing:0}
 for(const t of data.transactions){let debit=0,credit=0;for(const row of t.entries){assert.ok(Object.hasOwn(data.accountTypes,row.account));assert.ok(Number.isSafeInteger(row.debit)&&row.debit>=0&&Number.isSafeInteger(row.credit)&&row.credit>=0);assert.ok((row.debit===0)!==(row.credit===0));debit+=row.debit;credit+=row.credit;balances[row.account]=(balances[row.account]??0)+row.debit-row.credit}assert.equal(debit,credit,t.id+' unbalanced');if(t.cashCategory){assert.ok(Object.hasOwn(cashFlows,t.cashCategory));cashFlows[t.cashCategory]+=t.cashAmount}}
 const sum=type=>Object.entries(balances).filter(([account])=>data.accountTypes[account]===type).reduce((v,[,amount])=>v+amount,0)
 const trialDebit=Object.values(balances).filter(v=>v>0).reduce((a,b)=>a+b,0),trialCredit=-Object.values(balances).filter(v=>v<0).reduce((a,b)=>a+b,0),profit=-sum('revenue')-sum('expense'),assets=sum('asset'),liabilities=-sum('liability'),closingEquity=-sum('equity')+profit,netCash=Object.values(cashFlows).reduce((a,b)=>a+b,0)
 const actual={balances,trialDebit,trialCredit,profit,assets,liabilities,closingEquity,cashFlows,netCash};assert.equal(assets,liabilities+closingEquity);assert.equal(netCash,balances['银行存款']);assert.deepEqual(actual,data.expected);return actual
}
if(process.argv[1]&&import.meta.url===(await import('node:url')).pathToFileURL(process.argv[1]).href){const data=JSON.parse(await readFile(new URL('../references/case.json',import.meta.url),'utf8'));console.log(JSON.stringify({caseId:data.caseId,passed:true,result:checkCase(data)},null,2))}
