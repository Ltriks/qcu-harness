#include "NativeProcess.h"
#include <spawn.h>
#include <sys/wait.h>
#include <sys/proc_info.h>
#include <sys/proc.h>
#include <sys/sysctl.h>
#include <libproc.h>
#include <unistd.h>
#include <fcntl.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>

static int identity(struct owned_child *c) {
    siginfo_t exited = {0};
    // Unreaped child exit is kernel proof the recorded PID cannot be reused.
    if (waitid(P_PID, c->pid, &exited, WEXITED | WNOHANG | WNOWAIT) == 0 && exited.si_pid == c->pid) return 1;
    struct proc_bsdinfo info;
    if (proc_pidinfo(c->pid, PROC_PIDTBSDINFO, 0, &info, sizeof(info)) != sizeof(info)) return 0;
    return info.pbi_uid == getuid() && info.pbi_pgid == c->pid &&
      info.pbi_start_tvsec == c->sec && info.pbi_start_tvusec == c->usec;
}
int owned_spawn(const char *exe, char *const argv[], char *const env[], const char *cwd, struct owned_child *out) {
    int p[2]; if (pipe(p)) return errno;
    posix_spawnattr_t attr; posix_spawnattr_init(&attr);
    posix_spawnattr_setflags(&attr, POSIX_SPAWN_SETPGROUP | POSIX_SPAWN_CLOEXEC_DEFAULT);
    posix_spawnattr_setpgroup(&attr, 0);
    posix_spawn_file_actions_t a; posix_spawn_file_actions_init(&a);
    posix_spawn_file_actions_addopen(&a, 0, "/dev/null", O_RDONLY, 0);
    posix_spawn_file_actions_adddup2(&a, p[1], 1); posix_spawn_file_actions_adddup2(&a, p[1], 2);
    posix_spawn_file_actions_addclose(&a, p[0]); posix_spawn_file_actions_addclose(&a, p[1]);
    posix_spawn_file_actions_addchdir_np(&a, cwd);
    pid_t pid;
    int rc = posix_spawn(&pid, exe, &a, &attr, argv, env);
    posix_spawn_file_actions_destroy(&a); posix_spawnattr_destroy(&attr); close(p[1]);
    if (rc) { close(p[0]); return rc; }
    struct proc_bsdinfo info;
    if (proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &info, sizeof(info)) != sizeof(info) || info.pbi_pgid != pid || info.pbi_uid != getuid()) {
        // Exact unreaped direct child only; never an unverified process group.
        kill(pid, SIGKILL); waitpid(pid, NULL, 0); close(p[0]); return EPERM;
    }
    *out = (struct owned_child){pid, info.pbi_start_tvsec, info.pbi_start_tvusec, p[0]};
    fcntl(p[0], F_SETFL, O_NONBLOCK); return 0;
}
int owned_exited(struct owned_child *c) {
    siginfo_t info = {0};
    if (waitid(P_PID, c->pid, &info, WEXITED | WNOHANG | WNOWAIT)) return -1;
    return info.si_pid == c->pid;
}
int owned_finish(struct owned_child *c, int *status) {
    // Leader stays unreaped until group cleanup: PID/PGID cannot be reused.
    if (!identity(c)) return EPERM;
    kill(-c->pid, SIGTERM); usleep(100000);
    if (!identity(c)) return EPERM;
    kill(-c->pid, SIGKILL);
    int value;
    if (waitpid(c->pid, &value, 0) != c->pid) return errno;
    *status = WIFEXITED(value) ? WEXITSTATUS(value) : 128 + WTERMSIG(value);
    close(c->output); c->output = -1; return 0;
}
int official_app_busy(const char *app) {
    int needed = proc_listpids(PROC_UID_ONLY, getuid(), NULL, 0);
    if (needed <= 0) return -1;
    int size = needed + 4096;
    pid_t *pids = calloc(1, size);
    if (!pids) return -1;
    int bytes = proc_listpids(PROC_UID_ONLY, getuid(), pids, size);
    if (bytes <= 0 || bytes >= size) { free(pids); return -1; }
    int result = 0; size_t length = strlen(app);
    for (int i=0; i<bytes/(int)sizeof(pid_t); i++) {
        pid_t pid=pids[i]; if (pid <= 0) continue;
        struct proc_bsdinfo info;
        if (proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &info, sizeof(info)) != sizeof(info)) {
            if (kill(pid, 0) == -1 && errno == ESRCH) continue;
            // Protected system tasks may deny libproc; use kernel UID only.
            int mib[4] = {CTL_KERN, KERN_PROC, KERN_PROC_PID, pid};
            struct kinfo_proc ki; size_t len = sizeof(ki);
            if (sysctl(mib, 4, &ki, &len, NULL, 0) == 0) {
                if (len == 0 || ki.kp_eproc.e_ucred.cr_uid != getuid()) continue;
            }
            result = -2; break;
        }
        if (info.pbi_uid != getuid() || info.pbi_status == SZOMB) continue;
        char path[PROC_PIDPATHINFO_MAXSIZE] = {0};
        if (proc_pidpath(pid, path, sizeof(path)) <= 0) { result=-3; break; }
        if (!strncmp(path, app, length) && (path[length]=='/' || path[length]=='\0')) { result=1; break; }
    }
    free(pids); return result;
}

int native_pid_stopped(pid_t pid) {
    for (int i=0; i<100; i++) {
        struct proc_bsdinfo info;
        if (proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &info, sizeof(info)) == sizeof(info)) {
            if (info.pbi_status == SZOMB) return 1;
        } else if (kill(pid, 0) == -1 && errno == ESRCH) return 1;
        usleep(10000);
    }
    return 0;
}
