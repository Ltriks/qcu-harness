import {marketFailureMessage} from './extracted/package/src/market-errors.mjs'

function assert(cond,msg){if(!cond)throw Error(msg)}

function caseOf(label,err,code){
 const msg=marketFailureMessage(err)
 assert(msg.includes('['+code+']'), label+' expected '+code+' got '+msg)
 if(err.marketDiagnostic){
  assert(msg.includes('维护：阶段='), label+' missing diagnostic')
  assert(msg.includes('代理='), label+' missing proxy flag')
 }
 console.log('ok', label, '=>', msg.slice(0,96)+'...')
}

const fetchFail=Object.assign(new TypeError('fetch failed'),{
 cause:Object.assign(new Error('connect'),{code:'ECONNREFUSED'}),
 marketDiagnostic:{phase:'request',httpStatus:null,proxyUsed:false,durationMs:12},
})
const otherType=Object.assign(new TypeError('Cannot read properties of null'),{
 marketDiagnostic:{phase:'response',httpStatus:200,proxyUsed:false,durationMs:5},
})
const httpErr=Object.assign(new Error('Catalog authority: HTTP'),{
 code:'QCU-MKT-HTTP',
 marketDiagnostic:{phase:'response',httpStatus:503,proxyUsed:true,durationMs:9},
})

caseOf('fetch TypeError', fetchFail, 'QCU-MKT-OFFLINE')
caseOf('other TypeError', otherType, 'QCU-MKT-FORMAT')
caseOf('http', httpErr, 'QCU-MKT-HTTP')
caseOf('expired', Object.assign(new Error('x'),{code:'QCU-MKT-CATALOG-EXPIRED'}), 'QCU-MKT-CATALOG-EXPIRED')
caseOf('clock', Object.assign(new Error('x'),{code:'QCU-MKT-CLOCK'}), 'QCU-MKT-CLOCK')
caseOf('timeout', Object.assign(new Error('timeout'),{name:'TimeoutError'}), 'QCU-MKT-TIMEOUT')
caseOf('signature', Object.assign(new Error('signature'),{code:'QCU-MKT-SIGNATURE'}), 'QCU-MKT-SIGNATURE')
console.log('PASS 7')
