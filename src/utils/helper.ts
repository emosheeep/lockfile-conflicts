import { skipEnvName } from './constants';

export function splitFile(filename: string): string[] {
  return fs.readFileSync(filename, 'utf8').trim().split('\n');
}

export function shouldSkipExec() {
  return process.env[skipEnvName] === 'true';
}

type NestedArray<T> = T | NestedArray<T>[];

export function joinNestedArray(arr: NestedArray<string>, indent = '') {
  let result = '';
  for (let i = 0; i < arr.length; i++) {
    result += Array.isArray(arr[i])
      ? '\n' + joinNestedArray(arr[i], indent + '  ')
      : '\n' + indent + arr[i];
  }
  return result.replace(/^\n|\n$/g, ''); // remove leading and trailing space
}
