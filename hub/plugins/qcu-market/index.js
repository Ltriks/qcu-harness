import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { PackagePreparation } from './src/host-core.mjs'
import { remoteContribution } from './src/remote-contract.mjs'
export const name='qcu-market'
export const inject=['typert']
class QcuPackageService extends TypertRemoteService {
  constructor(ctx){super(ctx,'qcuMarket');this.packages=new PackagePreparation();ctx.effect(()=>()=>this.packages.dispose())}
  prepare(id,signal){return this.packages.prepare(id,signal)}
  verify(id,signal){return this.packages.verify(id,signal)}
  cancel(id){return this.packages.cancel(id)}
}
export function apply(ctx){
  new QcuPackageService(ctx)
  ctx.typert.register({package:'qcu-market',face:'host',schemas:[],invocations:remoteContribution.descriptors,model:{services:[],events:[],objects:[]}})
}
