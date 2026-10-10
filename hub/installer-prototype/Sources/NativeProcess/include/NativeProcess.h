#include <sys/types.h>
#include <stdint.h>
struct owned_child { pid_t pid; uint64_t sec; uint64_t usec; int output; };
int owned_spawn(const char *exe, char *const argv[], char *const env[], const char *cwd, struct owned_child *out);
int owned_exited(struct owned_child *child);
int owned_finish(struct owned_child *child, int *status);
int official_app_busy(const char *app_path);

int native_pid_stopped(pid_t pid);
