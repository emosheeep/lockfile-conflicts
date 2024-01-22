import { skipEnvName } from './constants';

export function splitFile(filename: string): string[] {
  return fs.readFileSync(filename, 'utf8').trim().split('\n');
}

export function shouldSkipExec() {
  return process.env[skipEnvName] === 'true';
}
