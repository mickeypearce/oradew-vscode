const git = require("gulp-git");

let obj = {};

obj.exec = ({ args }) =>
  new Promise((res, rej) => {
    git.exec({ args, quiet: true }, (err, stdout) => {
      if (err) rej(err);
      res(stdout);
    });
  });

obj.getChanges = () => obj.exec({ args: `diff --name-only HEAD ./src` });
obj.getChangesStaged = () =>
  obj.exec({ args: `diff --name-only --staged ./src` });

// Get tracked and untracked files
obj.getChangesNotStaged = () =>
  obj.exec({ args: `diff --name-only ./src & git ls-files --others ./src` });

// Files from commit or branch to the head (only from src and scripts dir)
obj.getCommitedFilesSincePoint = from =>
  obj.exec({
    args: `log --diff-filter=ACMR --name-only --pretty="" ${from}..head ./src ./scripts`
  });

// Get first commit on the current branch - or better:
// First commit that is "reffered by some branch or tag"
obj.getFirstCommitOnBranch = () =>
  obj.exec({
    args: `rev-list --simplify-by-decoration -1 head --skip=1`
  });

obj.cherryPickByGrepAndBranch = (grep, branch) =>
  obj.exec({
    args: `rev-list --reverse --grep=${grep} ${branch} | git cherry-pick -n --stdin`
  });

obj.getStashedFiles = () => obj.exec({ args: `stash show --name-only` });
obj.stash = () =>
  obj.exec({ args: `stash clear & git stash save --keep-index` });
obj.unstash = () => obj.exec({ args: `add --all & git stash pop` });

// Create and checkout new branch
obj.branch = branchName => obj.exec({ args: `checkout -b ${branchName}` });

module.exports = obj;
