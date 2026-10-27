import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { PackagePreparation } from './src/host-core.mjs'
import { remoteContribution, marketRuntime } from './src/remote-contract.mjs'
import {MarketUpdates} from './src/update-host.mjs'
import {getDshRuntimeVersion} from '@deepseek-ai/dsh-app-boot'
import {join} from 'node:path'
import {FeedbackReceiptJournal} from './src/feedback-storage.mjs'
import {FeedbackTransport} from './src/feedback-host.mjs'
export const name='qcu-market'
export const inject=['typert']
class QcuPackageService extends TypertRemoteService {
  constructor(ctx){
    super(ctx,'qcuMarket');this.packages=new PackagePreparation();this.feedback=new FeedbackTransport({runtime:getDshRuntimeVersion()})
    ctx.effect(()=>()=>{this.packages.dispose();this.feedback.dispose()})
    ctx.inject(['profileContext'],scope=>{
      const feedback=new FeedbackTransport({runtime:getDshRuntimeVersion(),journal:new FeedbackReceiptJournal(join(scope.profileContext.dir,'qcu-feedback-receipts'))})
      this.feedback.dispose();this.feedback=feedback;scope.effect(()=>()=>feedback.dispose())
    })
    ctx.inject(['profileContext','pluginManager'],scope=>{
      const updates=new MarketUpdates({profileDir:scope.profileContext.dir,runtime:getDshRuntimeVersion(),marketVersion:marketRuntime.version,inventory:async()=>({bundles:await scope.pluginManager.listBundles(),rows:await scope.pluginManager.listPlugins()})})
      this.updates=updates;scope.effect(()=>()=>{updates.dispose();if(this.updates===updates)this.updates=null})
    })
  }
  updateService(){if(!this.updates)throw Error('当前profile更新服务尚未就绪');return this.updates}
  status(){return JSON.stringify(marketRuntime)}
  feedbackSubmit(payload,signal){return this.feedback.post('submit',payload,signal)}
  feedbackStatus(payload,signal){return this.feedback.post('status',payload,signal)}
  feedbackReceipts(){return this.feedback.receipts()}
  refresh(){return this.packages.refresh()}
  prepare(id,releaseKey,signal){return this.packages.prepare(id,releaseKey,signal)}
  verify(id,signal){return this.packages.verify(id,signal)}
  cancel(id){return this.packages.cancel(id)}
  updatesCheck(signal){return this.updateService().check(signal)}
  updatesPrepare(id,key,signal){return this.updateService().prepare(id,key,signal)}
  updatesVerify(id){return this.updateService().verify(id)}
  updatesCancel(id){return this.updateService().cancel(id)}
  updatesJournal(id,requestId){return this.updateService().journal(id,requestId)}
  updatesRecovery(){return this.updateService().recovery()}
  updatesAcknowledge(requestId,state){return this.updateService().acknowledge(requestId,state)}
}
export function apply(ctx){
  new QcuPackageService(ctx)
  ctx.typert.register({package:'qcu-market',face:'host',schemas:[],invocations:remoteContribution.descriptors,model:{services:[],events:[],objects:[]}})
}
