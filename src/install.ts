import { Dependence } from "./types";
import { YarnLock } from "./YarnLock";
import { getPkgInfo as defaultGetPkgInfo } from "./yarn";

export function createInstall(
  yarnLock: YarnLock,
  // it can be replaced for testing
  getPkgInfo: (
    name: string,
    scope: string
  ) => Promise<{ dependence: Dependence; range: string } | null> = defaultGetPkgInfo
) {
  return async function install(
    name: string,
    scope: string,
    {
      ref,
      develop,
    }: {
      develop?: boolean;
      ref?: string;
    } = {}
  ) {
    const { dependence, range } = await getPkgInfo(name, scope);
    yarnLock.add(name, range, dependence, { write: !ref, develop, dependenceBy: ref });
    if (dependence.dependencies) {
      for (let depName in dependence.dependencies) {
        const depRange = dependence.dependencies[depName];
        const info = yarnLock.match(depName, depRange);
        if (info) {
          yarnLock.add(depName, depRange, info, { dependenceBy: `${name}@${range}` });
        } else {
          await install(depName, depRange, { ref: `${name}@${range}` });
        }
      }
    }
  };
}
