export const logger = {
  print: (...args) => console.log(...args),
  info: (...args) => console.log(chalk.blue.bold('info'), ...args),
  warn: (...args) => console.log(chalk.yellow.bold('warn'), ...args),
  error: (...args) => console.log(chalk.red.bold('error'), ...args),
  success: (...args) => console.log(chalk.green.bold('success'), ...args),
};

export function printHints(filename: string) {
  logger.info(`${filename} conflicts, accept theirs version.`);
}
