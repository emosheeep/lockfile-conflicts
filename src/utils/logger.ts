class Logger {
  print = (...args) => console.log(...args);
  info = (...args) => this.#printArray(chalk.blue.bold('info'), ...args);
  warn = (...args) => this.#printArray(chalk.yellow.bold('warn'), ...args);
  error = (...args) => this.#printArray(chalk.red.bold('error'), ...args);
  success = (...args) => this.#printArray(chalk.green.bold('success'), ...args);
  #printArray = (flag, ...args) => {
    args.forEach((item) => console.log(flag, item));
  };
}

export const logger = new Logger();

export function printHints(filename: string) {
  logger.info(`${filename} conflicts, accept theirs version.`);
}
