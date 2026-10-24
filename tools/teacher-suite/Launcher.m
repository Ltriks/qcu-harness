// MIT. Native macOS entry point; the signed vendor app remains unchanged.
#import <Cocoa/Cocoa.h>

static BOOL fail(BOOL checking, NSString *message) {
    if (checking) {
        fprintf(stderr, "QCU_TEACHER_ERROR: %s\n", message.UTF8String);
    } else {
        [NSApplication sharedApplication];
        [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
        NSAlert *alert = [NSAlert new];
        alert.messageText = @"城院助手暂时未能打开";
        alert.informativeText = [message stringByAppendingString:@"\n\n请将此提示发给维护人员，已有数据会保留。"];
        [alert addButtonWithTitle:@"知道了"];
        [NSApp activateIgnoringOtherApps:YES];
        [alert runModal];
    }
    return NO;
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        BOOL checking = argc == 2 && strcmp(argv[1], "--prepare-only") == 0;
        NSString *root = NSBundle.mainBundle.resourcePath;
        NSString *executable = [root stringByAppendingPathComponent:@"program/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness"];
        NSString *bootstrap = [root stringByAppendingPathComponent:@"support/start.cjs"];
        NSFileManager *files = NSFileManager.defaultManager;
        if (![files isExecutableFileAtPath:executable] || ![files fileExistsAtPath:bootstrap])
            return fail(checking, @"应用文件不完整，请重新解压整个城院助手应用。") ? 0 : 1;
        NSMutableDictionary *environment = [NSProcessInfo.processInfo.environment mutableCopy];
        [environment removeObjectForKey:@"NODE_OPTIONS"];
        environment[@"ELECTRON_RUN_AS_NODE"] = @"1";
        NSTask *setup = [NSTask new];
        setup.executableURL = [NSURL fileURLWithPath:executable];
        setup.arguments = @[@"--expose-internals", bootstrap, @"prepare", @"--kit", root];
        setup.environment = environment;
        setup.currentDirectoryURL = [NSURL fileURLWithPath:root];
        NSPipe *out = [NSPipe pipe], *err = [NSPipe pipe];
        setup.standardOutput = out; setup.standardError = err;
        dispatch_semaphore_t done = dispatch_semaphore_create(0);
        setup.terminationHandler = ^(NSTask *task) { dispatch_semaphore_signal(done); };
        NSError *error = nil;
        if (![setup launchAndReturnError:&error]) return fail(checking, error.localizedDescription) ? 0 : 1;
        __block NSData *outputData, *errorData;
        dispatch_group_t readers = dispatch_group_create();
        dispatch_group_async(readers, dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{ outputData = [out.fileHandleForReading readDataToEndOfFile]; });
        dispatch_group_async(readers, dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{ errorData = [err.fileHandleForReading readDataToEndOfFile]; });
        if (dispatch_semaphore_wait(done, dispatch_time(DISPATCH_TIME_NOW, 120 * NSEC_PER_SEC))) {
            [setup terminate];
            return fail(checking, @"准备时间较长，请稍后重试。如仍未打开，请联系维护人员，不要删除已有数据。") ? 0 : 1;
        }
        dispatch_group_wait(readers, DISPATCH_TIME_FOREVER);
        NSString *output = [[NSString alloc] initWithData:outputData encoding:NSUTF8StringEncoding] ?: @"";
        NSString *errors = [[NSString alloc] initWithData:errorData encoding:NSUTF8StringEncoding] ?: @"";
        if (setup.terminationStatus != 0) return fail(checking, errors.length ? errors : output) ? 0 : 1;
        NSString *home = nil;
        for (NSString *line in [output componentsSeparatedByString:@"\n"])
            if ([line hasPrefix:@"QCU_TEACHER_HOME:"]) home = [line substringFromIndex:17];
        if (!home.length || ![files fileExistsAtPath:home]) return fail(checking, @"未能确认城院数据目录。") ? 0 : 1;
        if (checking) { printf("%s", output.UTF8String); return 0; }
        [environment removeObjectForKey:@"ELECTRON_RUN_AS_NODE"];
        environment[@"DSH_HOME"] = home;
        environment[@"DSH_AGENTS_HOME"] = [home stringByAppendingPathComponent:@"agents"];
        NSTask *app = [NSTask new];
        app.executableURL = [NSURL fileURLWithPath:executable];
        app.arguments = @[[NSString stringWithFormat:@"--user-data-dir=%@", [home stringByAppendingPathComponent:@"electron"]]];
        app.environment = environment;
        app.currentDirectoryURL = [NSURL fileURLWithPath:[home stringByAppendingPathComponent:@"workspace"]];
        app.standardOutput = [NSFileHandle fileHandleWithNullDevice];
        app.standardError = [NSFileHandle fileHandleWithNullDevice];
        if (![app launchAndReturnError:&error]) return fail(checking, error.localizedDescription) ? 0 : 1;
        return 0;
    }
}
