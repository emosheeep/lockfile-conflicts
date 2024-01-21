export function partition<T>(arr: T[], predicate: (v: T) => boolean) {
  const [positive, negative]: [T[], T[]] = [[], []];
  for (const item of arr) {
    predicate(item) ? positive.push(item) : negative.push(item);
  }
  return [positive, negative];
}
