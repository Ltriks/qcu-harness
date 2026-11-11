// Fixed UI messages. Never append raw network exceptions, URLs, response bodies or private paths.
const NETWORK_CODES=new Set(['ECONNREFUSED','ENETUNREACH','EHOSTUNREACH','ENOTFOUND','EAI_AGAIN','ECONNRESET','EPIPE','ECONNABORTED'])

function causeCode(error){
 return error?.cause?.code||error?.code||null
}

function isFetchNetworkFailure(error){
 if(!(error instanceof TypeError))return false
 const message=String(error?.message||'')
 if(/fetch failed|Failed to fetch|NetworkError|Load failed|network/i.test(message))return true
 return NETWORK_CODES.has(causeCode(error))
}

export function marketDiagnostic(error){
 const value=error?.marketDiagnostic
 if(!value||typeof value!=='object')return null
 const phase=typeof value.phase==='string'&&value.phase.length<=40?value.phase:'unknown'
 const httpStatus=Number.isInteger(value.httpStatus)?value.httpStatus:null
 const proxyUsed=value.proxyUsed===true
 const durationMs=Number.isFinite(value.durationMs)?Math.max(0,Math.round(value.durationMs)):null
 return {phase,httpStatus,proxyUsed,durationMs}
}

function diagnosticSuffix(error){
 const d=marketDiagnostic(error)
 if(!d)return ''
 return `（维护：阶段=${d.phase}; HTTP=${d.httpStatus??'无'}; 代理=${d.proxyUsed?'是':'否'}; 耗时=${d.durationMs??'未知'}ms）`
}

function localNetworkHint(error){
 if(process.platform!=='darwin'||!isFetchNetworkFailure(error))return ''
 const code=causeCode(error)
 if(code==='EHOSTUNREACH'||code==='ENETUNREACH'){
  return ' 应用进程无法访问局域网地址；请确认「本地网络」已允许 DeepSeek Harness（不只是外层启动器），或改用本版内置直连回退。'
 }
 return ' 若终端 curl 已通而应用仍失败，请在「系统设置 → 隐私与安全性 → 本地网络」允许 DeepSeek Harness。'
}

function proxyHint(error){
 const d=marketDiagnostic(error)
 if(!d?.proxyUsed)return ''
 return ' 检测到系统或环境代理；终端 curl 默认直连，请在「系统设置 → 网络 → 详情 → 代理」核对或临时关闭后再刷新。'
}

export function marketFailureMessage(error){
 const code=error?.code
 const suffix=diagnosticSuffix(error)
 if(code==='QCU-MKT-CATALOG-EXPIRED')return '[QCU-MKT-CATALOG-EXPIRED] 工具目录已超过发布有效期，请维护人员重新签发；已安装工具可继续使用。'+suffix
 if(code==='QCU-MKT-CLOCK')return '[QCU-MKT-CLOCK] 发布清单尚未生效，请核对设备时间或联系维护人员。'+suffix
 if(code==='QCU-MKT-HTTP')return '[QCU-MKT-HTTP] 校内工具市场返回了异常状态，请维护人员核对服务；已安装工具可继续使用。'+suffix+proxyHint(error)
 if(code==='QCU-MKT-FORMAT')return '[QCU-MKT-FORMAT] 工具目录响应格式无效，请维护人员核对发布内容；已安装工具可继续使用。'+suffix
 if(code==='QCU-MKT-SIGNATURE')return '[QCU-MKT-SIGNATURE] 工具目录签名校验失败，请维护人员重新签发；已安装工具可继续使用。'+suffix
 if(code==='QCU-MKT-STATE')return '[QCU-MKT-STATE] 本机市场缓存目录无法安全写入，请联系维护人员核对权限；已安装工具可继续使用。'+suffix
 if(error?.name==='TimeoutError'||error?.name==='AbortError'||causeCode(error)==='ETIMEDOUT'||code==='ETIMEDOUT')return '[QCU-MKT-TIMEOUT] 连接工具市场超时，请核对是否能访问校内市场；稍后可重新刷新。'+suffix
 if(NETWORK_CODES.has(causeCode(error))||isFetchNetworkFailure(error))return '[QCU-MKT-OFFLINE] 暂时无法连接校内工具市场，请核对网络或联系维护人员。'+suffix+localNetworkHint(error)+proxyHint(error)
 // Non-network TypeError (for example UTF-8 decode) must not look like offline.
 if(error instanceof TypeError)return '[QCU-MKT-FORMAT] 工具目录响应无法解析，请维护人员核对发布内容；已安装工具可继续使用。'+suffix
 return '[QCU-MKT-VERIFY] 工具目录暂未通过验证，请联系维护人员；已安装工具可继续使用。'+suffix
}
