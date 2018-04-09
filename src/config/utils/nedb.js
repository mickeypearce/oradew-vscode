const Datastore = require("nedb");
import { join } from "path";

const filename = join(__dirname, "exported.db");

const db = new Datastore({
  filename,
  autoload: true
});

const user = process.env.username;

const upsertDdlTime = ({ owner, objectName, objectType }, lastDdlTime) =>
  new Promise((res, rej) => {
    db.update(
      // Where
      { owner, objectName, objectType },
      // Set
      { $set: { lastDdlTime, savedTime: new Date(), user } },
      // Options
      { upsert: true, returnUpdatedDocs: true },
      // Then
      (err, numReplaced, upsert) => {
        if (err) rej(err);
        res(upsert);
      }
    );
  });

const getDdlTime = ({ owner, objectName, objectType }) =>
  new Promise((res, rej) => {
    db.find({ owner, objectName, objectType }, (err, findObj) => {
      if (err) rej(err);
      res(findObj.length !== 0 ? findObj[0].lastDdlTime : 0);
    });
  });

module.exports.getDdlTime = getDdlTime;
module.exports.upsertDdlTime = upsertDdlTime;
