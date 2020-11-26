import { YarnLock } from "../types";

function pick(record: Record<string, any>, keys: string[]) {
  return keys.reduce<Record<string, unknown>>((pre, cur) => {
    return { ...pre, [cur]: record[cur] };
  }, {});
}

export function formatYarnData(data: YarnLock) {
  return Object.keys(data).reduce<Record<string, { version: string }>>((pre, cur) => {
    pre[cur] = pick(data[cur], ["version"]) as { name: string; version: string };
    return pre;
  }, {});
}
