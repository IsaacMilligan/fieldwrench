const fs = require("fs");
const path = require("path");

function copyInstead(target, dest) {
  const resolved = path.resolve(path.dirname(dest), target);
  fs.cpSync(resolved, dest, { recursive: true, force: true });
}

const origSync = fs.symlinkSync.bind(fs);
fs.symlinkSync = function (target, dest, type) {
  try {
    return origSync(target, dest, type);
  } catch (e) {
    if (e && (e.code === "EPERM" || e.code === "EEXIST")) {
      copyInstead(String(target), String(dest));
      return;
    }
    throw e;
  }
};

const orig = fs.symlink.bind(fs);
fs.symlink = function (target, dest, type, cb) {
  if (typeof type === "function") {
    cb = type;
    type = undefined;
  }
  orig(target, dest, type, (err) => {
    if (err && (err.code === "EPERM" || err.code === "EEXIST")) {
      try {
        copyInstead(String(target), String(dest));
        cb && cb(null);
      } catch (e) {
        cb && cb(e);
      }
      return;
    }
    cb && cb(err);
  });
};

if (fs.promises && fs.promises.symlink) {
  const origP = fs.promises.symlink.bind(fs.promises);
  fs.promises.symlink = async function (target, dest, type) {
    try {
      return await origP(target, dest, type);
    } catch (e) {
      if (e && (e.code === "EPERM" || e.code === "EEXIST")) {
        copyInstead(String(target), String(dest));
        return;
      }
      throw e;
    }
  };
}
