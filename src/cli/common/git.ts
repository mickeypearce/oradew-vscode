import { exec as gitExec } from "gulp-git";
import { srcDir } from "./dbobject";

// @todo refactor to simple-git, graceful-git

export const exec = ({ args }) =>
  new Promise((res, rej) => {
    gitExec({ args, quiet: process.env.ORADEW_SILENT }, (err, stdout) => {
      if (err) {
        rej(err);
      }
      res(stdout);
    });
  });


export const getChanges = () => exec({ args: `diff --name-only HEAD ${srcDir()}` });
export const getChangesStaged = () => exec({ args: `diff --name-only --staged ${srcDir()}` });

// Get tracked and untracked files
export const getChangesNotStaged = () =>
  exec({ args: `diff --name-only ${srcDir()} & git ls-files --others ${srcDir()}` });

// Files from commit or branch to the head (only from src and scripts dir)
export const getCommitedFilesSincePoint = (from) =>
  exec({
    args: `log --diff-filter=ACMR --name-only --pretty="" ${from}..head ${srcDir()} ./scripts`,
  });

// Files from specific commits (only from src and scripts dir)
export const getCommitedFilesByCommits = (commits: string[]) =>
  exec({
    args: `show --diff-filter=ACMR --name-only --pretty="" ${commits.join(" ")} ${srcDir()} ./scripts`,
  });

// Get first commit on the current branch
export const getFirstCommitOnBranch = () =>
  exec({
    // First commit that is "reffered by some branch or tag"
    // args: `rev-list --simplify-by-decoration -1 head --skip=1`
    // Get latest commit that is tagged
    args: `rev-list -1 --tags`,
  });

export const cherryPickByGrepAndBranch = (grep, branch) =>
  exec({
    args: `rev-list --reverse --grep=${grep} ${branch} | git cherry-pick -n --stdin`,
  });

export const getStashedFiles = () => exec({ args: `stash show --name-only` });
export const stash = () => exec({ args: `stash clear & git stash save --keep-index` });
export const unstash = () => exec({ args: `add --all & git stash pop` });

// Create and checkout new branch
export const branch = (branchName) => exec({ args: `checkout -b ${branchName}` });
