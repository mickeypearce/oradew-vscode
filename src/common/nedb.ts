import * as Datastore from "nedb";
import { join } from "path";

const filename = join(
  process.env.ORADEW_STORAGE_DIR || __dirname,
  "exported.db"
);

const db = new Datastore({
  filename,
  autoload: true
});

const user = process.env.username;

const upsertDdlTime = ({ owner, objectName, objectType }, lastDdlTime, env) =>
  new Promise((res, rej) => {
    db.update(
      // Where
      { owner, objectName, objectType, env },
      // Set
      { $set: { lastDdlTime, savedTime: new Date(), user } },
      // Options
      { upsert: true, returnUpdatedDocs: true },
      // Then
      (err, numReplaced, upsert) => {
        if (err) { rej(err); }
        res(upsert);
      }
    );
  });

const getDdlTime = ({ owner, objectName, objectType }, env) =>
  new Promise((res, rej) => {
    db.find({ owner, objectName, objectType, env }, (err, findObj) => {
      if (err) { rej(err); }
      res(findObj.length !== 0 ? findObj[0].lastDdlTime : null);
    });
  });

export { getDdlTime, upsertDdlTime };
