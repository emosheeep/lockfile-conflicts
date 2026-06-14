#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/wait.h>
#include <termios.h>
#include <unistd.h>

static void exec_command(char **argv) {
  execvp(argv[0], argv);
  perror("foreground: execvp");
  _exit(127);
}

static int restore_tty(int tty_fd, pid_t old_pgrp) {
  if (tcsetpgrp(tty_fd, old_pgrp) < 0) {
    perror("foreground: restore tcsetpgrp");
    return -1;
  }
  return 0;
}

static void restore_signal(int signum, void (*handler)(int)) {
  if (signal(signum, handler) == SIG_ERR) {
    perror("foreground: restore signal handler");
  }
}

static int is_interrupted_status(int status) {
  if (WIFSIGNALED(status)) {
    int signal_number = WTERMSIG(status);
    return signal_number == SIGINT || signal_number == SIGTERM;
  }
  if (WIFEXITED(status)) {
    int exit_code = WEXITSTATUS(status);
    return exit_code == 130 || exit_code == 143;
  }
  return 0;
}

static void terminate_process_group(pid_t pgid) {
  if (pgid <= 0) {
    return;
  }

  if (kill(-pgid, SIGTERM) < 0 && errno != ESRCH) {
    perror("foreground: terminate process group");
  }
  usleep(100000);
  if (kill(-pgid, SIGKILL) < 0 && errno != ESRCH) {
    perror("foreground: kill process group");
  }
}

int main(int argc, char **argv) {
  if (argc > 1 && argv[1][0] == '-' && argv[1][1] == '-' && argv[1][2] == '\0') {
    argc--;
    argv++;
  }

  if (argc < 2) {
    fprintf(stderr, "usage: foreground [--] command [arg ...]\n");
    return 2;
  }

  int tty_fd = open("/dev/tty", O_RDWR);
  if (tty_fd < 0) {
    exec_command(&argv[1]);
  }

  pid_t old_pgrp = tcgetpgrp(tty_fd);
  if (old_pgrp < 0) {
    perror("foreground: tcgetpgrp");
    close(tty_fd);
    exec_command(&argv[1]);
  }

  pid_t child = fork();
  if (child < 0) {
    perror("foreground: fork");
    close(tty_fd);
    return 1;
  }

  if (child == 0) {
    setpgid(0, 0);
    exec_command(&argv[1]);
  }

  if (setpgid(child, child) < 0 && errno != EACCES) {
    perror("foreground: setpgid");
    kill(child, SIGTERM);
    close(tty_fd);
    return 1;
  }

  void (*old_ttou)(int) = signal(SIGTTOU, SIG_IGN);
  void (*old_ttin)(int) = signal(SIGTTIN, SIG_IGN);
  void (*old_tstp)(int) = signal(SIGTSTP, SIG_IGN);

  if (old_ttou == SIG_ERR || old_ttin == SIG_ERR || old_tstp == SIG_ERR) {
    perror("foreground: install signal handler");
    kill(child, SIGTERM);
    close(tty_fd);
    return 1;
  }

  if (tcsetpgrp(tty_fd, child) < 0) {
    perror("foreground: tcsetpgrp");
    kill(child, SIGTERM);
    restore_tty(tty_fd, old_pgrp);
    restore_signal(SIGTTOU, old_ttou);
    restore_signal(SIGTTIN, old_ttin);
    restore_signal(SIGTSTP, old_tstp);
    close(tty_fd);
    return 1;
  }

  int status = 0;
  int wait_failed = 0;
  while (waitpid(child, &status, 0) < 0) {
    if (errno == EINTR) {
      continue;
    }
    perror("foreground: waitpid");
    wait_failed = 1;
    break;
  }

  if (!wait_failed && is_interrupted_status(status)) {
    terminate_process_group(child);
  }

  int restore_failed = restore_tty(tty_fd, old_pgrp) < 0;
  restore_signal(SIGTTOU, old_ttou);
  restore_signal(SIGTTIN, old_ttin);
  restore_signal(SIGTSTP, old_tstp);
  close(tty_fd);

  if (wait_failed || restore_failed) {
    return 1;
  }
  if (WIFEXITED(status)) {
    return WEXITSTATUS(status);
  }
  if (WIFSIGNALED(status)) {
    return 128 + WTERMSIG(status);
  }
  return 1;
}
