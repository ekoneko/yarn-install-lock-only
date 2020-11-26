import fs from "fs";
import path from "path";
import { YarnLock } from "../YarnLock";

describe("yarn lock", () => {
  const resourcePath = path.join(__dirname, "resources");
  const pkgJsonFile = fs.readFileSync(path.join(resourcePath, "package.default.json")).toString();
  const lockFile = fs.readFileSync(path.join(resourcePath, "yarn.default.lock")).toString();

  test("constructor", () => {
    const yarnLock = new YarnLock(pkgJsonFile, lockFile);
    // get private variables for test
    const { packageMap, packageRef } = yarnLock as any;

    expect(Object.keys(packageMap)).toEqual(["@fake/a@1.0.0", "@fake/b@1.0.0"]);
    expect(packageMap["@fake/a@1.0.0"].dependencies).toEqual({ "@fake/b": "^1.0.0" });
    expect(packageRef).toEqual({
      "@fake/a@^1.0.0": ["ROOT_REF"],
      "@fake/b@^1.0.0": ["@fake/a@^1.0.0"],
    });
  });
});
