#include <unistd.h>
#include <sys/time.h>
#include <sys/resource.h>
#include <sys/user.h>
#include <sys/syscall.h>
#include <stdio.h>
#include <signal.h>
#include <sys/wait.h>
#include <sys/ptrace.h>
#include <inttypes.h>
#include <stdbool.h>

int syscall_cnt[512];
pid_t pid;

void syscall_init() {
	syscall_cnt[__NR_read] = -1;
	syscall_cnt[__NR_write] = -1;
	syscall_cnt[__NR_fstat] = -1;
	syscall_cnt[__NR_mmap] = -1;
	syscall_cnt[__NR_munmap] = -1;
	syscall_cnt[__NR_brk] = -1;
	syscall_cnt[__NR_access] = 2;
	syscall_cnt[__NR_execve] = 1;
	syscall_cnt[__NR_exit] = 1;
	syscall_cnt[__NR_uname] = 2;
	syscall_cnt[__NR_readlink] = 2;
	syscall_cnt[__NR_arch_prctl] = 2;
	syscall_cnt[__NR_exit_group] = 1;
}

int watch_AI() {
	int status;
	struct user_regs_struct reg;
	for (;;) {
		wait(&status);
		if (WIFEXITED(status)) {
			break;
		} else if (WIFSIGNALED(status)) {
			printf("Terminated by a signal: %d\n", WTERMSIG(status));
			return 1;
		} else if (WIFSTOPPED(status)) {
			int signum = WSTOPSIG(status);
			if (signum != SIGTRAP) {
				ptrace(PTRACE_SYSCALL, pid, NULL, (void *) ((uintptr_t) signum));
				continue;
			}
		}
		ptrace(PTRACE_GETREGS, pid, NULL, &reg);
		if (reg.orig_rax >= 512ULL) {
			fprintf(stderr, "Reported syscall number: %lld\n", reg.orig_rax);
		} else {
			if (!syscall_cnt[reg.orig_rax]) {
				printf("Runtime error: Nonprivileged system call %lld\n", reg.orig_rax);
				kill(pid, SIGKILL);
				return 1;
			} else if (~syscall_cnt[reg.orig_rax]) {
				syscall_cnt[reg.orig_rax]--;
			}
		}
		ptrace(PTRACE_SYSCALL, pid, NULL, NULL);
	}
	puts("");
	printf("Child terminated with exit code %d.\n", WEXITSTATUS(status));
	return 0;
}

void run_AI(char **argv) {
	struct rlimit filelimit;
	filelimit.rlim_cur = 2;
	filelimit.rlim_max = 2;
	struct rlimit memorylimit;
	memorylimit.rlim_cur = (1 << 29);
	memorylimit.rlim_max = (1 << 29);
	setrlimit(RLIMIT_NOFILE, &filelimit);
	setrlimit(RLIMIT_AS, &memorylimit);
	ptrace(PTRACE_TRACEME, 0, NULL, NULL);
	execv(argv[0], argv);
	_exit(1);
}

void kill_AI(int signum) {
	kill(pid, SIGKILL);
}

int main(int argc, char **argv) {
	if (argc < 2) {
		fprintf(stderr, "Nothing to execute.\n");
		return 1;
	}
	syscall_init();
	pid = fork();
	if (!pid) {
		run_AI(argv + 1);
	} else if (~pid) {
		freopen("jail/jail-3000/sandbox.log", "w", stdout);
		struct sigaction act;
		act.sa_handler = kill_AI;
		sigemptyset(&act.sa_mask);
		act.sa_flags = 0;
		if (sigaction(SIGTERM, &act, NULL) == -1) {
			printf("Sigaction error: Kill signal will directly sent to the parent.\n");
		}
		puts("Sandbox starts");
		return watch_AI(pid);
	} else {
		perror("fork");
		return 1;
	}
	return 0;
}
