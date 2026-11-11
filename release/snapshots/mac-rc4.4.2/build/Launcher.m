#import <Cocoa/Cocoa.h>
#include <stdio.h>
static NSString *const VERSION=@"0.1.0-rc.4.4";
static NSString *const BUILD=@"rc44.2";
static NSString *dataHome(void){NSString *test=NSProcessInfo.processInfo.environment[@"QCU_TEACHER_TEST_HOME"];return test.length?test.stringByStandardizingPath:[NSHomeDirectory() stringByAppendingPathComponent:[@"Library/Application Support/QCU-DSH/teacher/" stringByAppendingString:VERSION]];}
static BOOL noLinks(NSString *p){NSFileManager *fm=NSFileManager.defaultManager;for(NSString *x=p;x.length>1;x=x.stringByDeletingLastPathComponent){NSDictionary *a=[fm attributesOfItemAtPath:x error:nil];if(a&&![a[NSFileType] isEqual:NSFileTypeDirectory])return NO;}return YES;}
static int commit(NSString *stage,NSString *target){NSString *home=dataHome();if(![target isEqual:home]||![stage.stringByDeletingLastPathComponent isEqual:home.stringByDeletingLastPathComponent]||!([stage.lastPathComponent hasPrefix:@".qcu-upgrade-"]||[stage.lastPathComponent hasPrefix:@".qcu-prepare-"])||!noLinks(stage)||!noLinks(home.stringByDeletingLastPathComponent))return 10;return renamex_np(stage.fileSystemRepresentation,target.fileSystemRepresentation,RENAME_EXCL)==0?0:11;}
static BOOL fail(BOOL checking,NSString *message){
 if(![message containsString:@"故障编号："])message=[message stringByAppendingFormat:@"\n故障编号：%@",NSUUID.UUID.UUIDString.lowercaseString];
 if(checking){fprintf(stderr,"%s\n",message.UTF8String);return NO;}
 [NSApplication sharedApplication];[NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];[NSApp finishLaunching];
 NSString *footer=[NSString stringWithFormat:@"\n\n套件 %@ · 构建 %@\n已有数据保留。可复制或导出此提示交给维护人员。",VERSION,BUILD];
 NSString *body=[message stringByAppendingString:footer];
 while(YES){
  NSAlert *a=[NSAlert new];a.messageText=@"城院助手暂时未能打开";a.informativeText=body;
  [a addButtonWithTitle:@"关闭"];[a addButtonWithTitle:@"复制诊断"];[a addButtonWithTitle:@"导出诊断"];
  [NSApp activateIgnoringOtherApps:YES];NSModalResponse r=[a runModal];
  if(r==NSAlertFirstButtonReturn)break;
  NSString *safe=[body copy];
  if(r==NSAlertSecondButtonReturn){
   [NSPasteboard.generalPasteboard clearContents];
   [NSPasteboard.generalPasteboard setString:safe forType:NSPasteboardTypeString];
   break;
  }
  NSSavePanel *panel=[NSSavePanel savePanel];panel.nameFieldStringValue=@"QCU启动诊断.txt";
  if([panel runModal]==NSModalResponseOK)[safe writeToURL:panel.URL atomically:YES encoding:NSUTF8StringEncoding error:nil];
  break;
 }
 return NO;
}
static NSString *run(NSString *executable,NSString *root,NSDictionary *env,NSArray *args,int *status){NSTask *t=[NSTask new];t.executableURL=[NSURL fileURLWithPath:executable];t.arguments=args;t.environment=env;t.currentDirectoryURL=[NSURL fileURLWithPath:root];NSPipe *out=[NSPipe pipe],*err=[NSPipe pipe];t.standardOutput=out;t.standardError=err;
 dispatch_semaphore_t done=dispatch_semaphore_create(0);t.terminationHandler=^(NSTask *task){dispatch_semaphore_signal(done);};NSError *error=nil;if(![t launchAndReturnError:&error]){*status=1;return @"[QCU-ST-1301] 启动运行环境失败。";}
 __block NSData *o,*e;dispatch_group_t group=dispatch_group_create();dispatch_group_async(group,dispatch_get_global_queue(QOS_CLASS_UTILITY,0),^{o=[out.fileHandleForReading readDataToEndOfFile];});dispatch_group_async(group,dispatch_get_global_queue(QOS_CLASS_UTILITY,0),^{e=[err.fileHandleForReading readDataToEndOfFile];});
 if(dispatch_semaphore_wait(done,dispatch_time(DISPATCH_TIME_NOW,120*NSEC_PER_SEC))){[t terminate];*status=1;return @"[QCU-ST-1302] 准备时间过长，请先确认旧版已正常退出。";}dispatch_group_wait(group,DISPATCH_TIME_FOREVER);*status=t.terminationStatus;NSData *d=*status?e:o;NSString *text=[[NSString alloc]initWithData:d encoding:NSUTF8StringEncoding]?:@"";if(*status){NSRange p=[text rangeOfString:@"QCU_TEACHER_ERROR:"];if(p.location!=NSNotFound)return [text substringFromIndex:p.location];return @"[QCU-ST-1303] 运行环境异常退出；请联系维护人员。";}return text;
}
int main(int argc,const char *argv[]){@autoreleasepool{
 if(argc==4&&strcmp(argv[1],"--commit-upgrade")==0)return commit(@(argv[2]),@(argv[3]));
 BOOL checking=argc>=2&&strcmp(argv[1],"--prepare-only")==0;NSString *migration=nil;
 if(checking&&argc==3&&[@(argv[2]) hasPrefix:@"--migrate-from="])migration=[@(argv[2]) substringFromIndex:15];
 NSString *root=NSBundle.mainBundle.resourcePath,*exe=[root stringByAppendingPathComponent:@"program/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness"],*bootstrap=[root stringByAppendingPathComponent:@"support/start.cjs"];
 if(![NSFileManager.defaultManager isExecutableFileAtPath:exe]||![NSFileManager.defaultManager fileExistsAtPath:bootstrap])return fail(checking,@"[QCU-ST-1304] 应用文件不完整，请完整解压安装包。")?0:1;
 NSMutableDictionary *env=[NSProcessInfo.processInfo.environment mutableCopy];[env removeObjectForKey:@"NODE_OPTIONS"];[env removeObjectForKey:@"NODE_PATH"];env[@"ELECTRON_RUN_AS_NODE"]=@"1";env[@"QCU_SUITE_SUPPORT"]=[root stringByAppendingPathComponent:@"support"];env[@"QCU_SUITE_LAUNCHER"]=NSBundle.mainBundle.executablePath;
 int status=0;NSArray *(^args)(NSString *)=^NSArray *(NSString *action){return @[@"--expose-internals",bootstrap,action,@"--kit",root];};
 if(!checking){NSString *out=run(exe,root,env,args(@"inspect"),&status);if(status)return fail(NO,out)?0:1;NSDictionary *state=[NSJSONSerialization JSONObjectWithData:[out dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];NSArray *sources=state[@"sources"];if(!state)return fail(NO,@"[QCU-ST-1305] 无法确认本机升级状态。")?0:1;
 if(![state[@"targetExists"] boolValue]&&sources.count){[NSApplication sharedApplication];[NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];[NSApp finishLaunching];NSAlert *a=[NSAlert new];a.messageText=@"准备新版城院助手";a.informativeText=@"可复制旧版设置、密钥和工作记录到新版独立目录，旧版保持不变。请先正常退出旧版。课程工作台本版不加载，原有资料仍留在旧版。";for(NSString *v in sources)[a addButtonWithTitle:[@"保留 " stringByAppendingString:v]];[a addButtonWithTitle:@"全新配置"];[a addButtonWithTitle:@"取消"];[NSApp activateIgnoringOtherApps:YES];NSInteger selected=[a runModal]-NSAlertFirstButtonReturn;if(selected<(NSInteger)sources.count)migration=sources[selected];else if(selected!=(NSInteger)sources.count)return 0;}}
 NSMutableArray *prepare=[args(@"prepare") mutableCopy];if(migration){[prepare addObject:@"--migrate"];[prepare addObject:migration];}
 NSString *out=run(exe,root,env,prepare,&status);if(status)return fail(checking,out)?0:1;NSString *home=nil;for(NSString *line in [out componentsSeparatedByString:@"\n"])if([line hasPrefix:@"QCU_TEACHER_HOME:"])home=[line substringFromIndex:17];
 if(!home.length)return fail(checking,@"[QCU-ST-1306] 未能确认新版数据目录。")?0:1;if(checking){printf("%s",out.UTF8String);return 0;}
 [env removeObjectForKey:@"ELECTRON_RUN_AS_NODE"];env[@"DSH_HOME"]=home;env[@"DSH_AGENTS_HOME"]=[home stringByAppendingPathComponent:@"agents"];
 NSTask *app=[NSTask new];app.executableURL=[NSURL fileURLWithPath:exe];app.arguments=@[[@"--user-data-dir=" stringByAppendingString:[home stringByAppendingPathComponent:@"electron"]]];app.environment=env;app.currentDirectoryURL=[NSURL fileURLWithPath:[home stringByAppendingPathComponent:@"workspace"]];app.standardOutput=[NSFileHandle fileHandleWithNullDevice];app.standardError=[NSFileHandle fileHandleWithNullDevice];if(![app launchAndReturnError:nil])return fail(NO,@"[QCU-ST-1307] 无法打开界面，请重试或导出诊断。")?0:1;return 0;
}}
