import fs from "fs";
import path from "path";
import { YarnLock } from "../YarnLock";
import { getPkgInfo } from "./mockYarn";
import { createInstall } from "../install";
import { formatYarnData } from "./utils";

describe("add", () => {
  const resourcePath = path.join(__dirname, "resources");
  const pkgJsonFile = fs.readFileSync(path.join(resourcePath, "package.default.json")).toString();
  const lockFile = fs.readFileSync(path.join(resourcePath, "yarn.default.lock")).toString();

  test("add an independent module", async () => {
    const yarnLock = new YarnLock(pkgJsonFile, lockFile);
    const install = createInstall(yarnLock, getPkgInfo);
    await install("@fake/c", "^1.0.0");
    expect(yarnLock.pkgJson.dependencies).toEqual({
      "@fake/a": "^1.0.0",
      "@fake/c": "^1.0.0",
    });
    expect(formatYarnData(yarnLock.yarnData)).toEqual({
      "@fake/a@^1.0.0": { version: "1.0.0" },
      "@fake/b@^1.0.0": { version: "1.0.0" },
      "@fake/c@^1.0.0": { version: "1.0.0" },
    });
  });

  test("upgrade a module", async () => {
    const yarnLock = new YarnLock(pkgJsonFile, lockFile);
    const install = createInstall(yarnLock, getPkgInfo);
    await install("@fake/b", "^1.0.1");
    expect(yarnLock.pkgJson.dependencies).toEqual({
      "@fake/a": "^1.0.0",
      "@fake/b": "^1.0.1",
    });
    expect(formatYarnData(yarnLock.yarnData)).toEqual({
      "@fake/a@^1.0.0": { version: "1.0.0" },
      "@fake/b@^1.0.0": { version: "1.0.0" },
      "@fake/b@^1.0.1": { version: "1.1.0" },
    });
  });

  test("upgrade a module in package.json", async () => {
    const yarnLock = new YarnLock(pkgJsonFile, lockFile);
    const install = createInstall(yarnLock, getPkgInfo);
    await install("@fake/a", "latest", { develop: true });
    expect(yarnLock.pkgJson.devDependencies).toEqual({ "@fake/a": "^1.1.0" });
    expect(yarnLock.pkgJson.dependencies).toEqual({});
    expect(formatYarnData(yarnLock.yarnData)).toEqual({
      "@fake/a@^1.1.0": { version: "1.1.0" },
      "@fake/b@^1.1.0": { version: "1.1.0" },
    });
  });

  test("upgrade a module reduce dependencies", async () => {
    const yarnLock = new YarnLock(pkgJsonFile, lockFile);
    const install = createInstall(yarnLock, getPkgInfo);
    await install("@fake/a", "next");
    expect(yarnLock.pkgJson.dependencies).toEqual({ "@fake/a": "^2.0.0" });
    expect(formatYarnData(yarnLock.yarnData)).toEqual({
      "@fake/a@^2.0.0": { version: "2.0.0" },
    });
  });

  test("add a module with dependencies", async () => {
    const yarnLock = new YarnLock(pkgJsonFile, lockFile);
    const install = createInstall(yarnLock, getPkgInfo);
    await install("@fake/d", "1.0.0");
    expect(yarnLock.pkgJson.dependencies).toEqual({ "@fake/a": "^1.0.0", "@fake/d": "1.0.0" });
    expect(formatYarnData(yarnLock.yarnData)).toEqual({
      "@fake/a@^1.0.0": { version: "1.0.0" },
      "@fake/b@^1.0.0": { version: "1.0.0" },
      "@fake/d@1.0.0": { version: "1.0.0" },
      "@fake/a@1.0.1": { version: "1.0.1" },
      "@fake/b@^1.0.1": { version: "1.1.0" },
    });
  });
});
