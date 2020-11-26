import fs from "fs";
import path from "path";
import { YarnLock } from "../YarnLock";
import { getPkgInfo } from "./mockYarn";
import { createInstall } from "../install";
import { formatYarnData } from "./utils";

function trackFunction<F extends Function, P extends Array<any>>(fn: F) {
  let count = 0;
  function wrapperFn(...args: P) {
    count++;
    return fn(...args);
  }
  return { fn: wrapperFn, getCount: () => count };
}

describe("match", () => {
  const resourcePath = path.join(__dirname, "resources");
  const pkgJsonFile = fs.readFileSync(path.join(resourcePath, "package.match.json")).toString();
  const lockFile = fs.readFileSync(path.join(resourcePath, "yarn.match.lock")).toString();

  it("yarnLock.match()", () => {
    const yarnLock = new YarnLock(pkgJsonFile, lockFile);
    expect(yarnLock.match("@fake/a", "1.0.0")).toBeDefined();
    expect(yarnLock.match("@fake/a", "1.0.1")).toBeUndefined();
    expect(yarnLock.match("@fake/a", "^1.0.0")).toBeDefined();
    expect(yarnLock.match("@fake/a", "^1.0.1")).toBeUndefined();
  });

  it("do not request if range can be resolved in existing packages", async () => {
    const yarnLock = new YarnLock(pkgJsonFile, lockFile);
    const { fn: getPkgInfoWithTrack, getCount } = trackFunction<
      typeof getPkgInfo,
      [string, string?]
    >(getPkgInfo);
    const install = createInstall(yarnLock, getPkgInfoWithTrack);
    await install("@fake/a", "1.0.1");
    expect(yarnLock.pkgJson.dependencies).toEqual({
      "@fake/a": "1.0.1",
      "@fake/b": "^1.0.0",
    });
    expect(getCount()).toBe(1);
    expect(formatYarnData(yarnLock.yarnData)).toEqual({
      "@fake/a@1.0.1": {
        version: "1.0.1",
      },
      "@fake/b@^1.0.0": { version: "1.1.0" },
      "@fake/b@^1.0.1": { version: "1.1.0" },
    });
  });
});
