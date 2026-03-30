import { Octokit } from 'octokit';
import { config } from '../config';

let octokit: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokit) {
    octokit = new Octokit({ auth: config.github.token });
  }
  return octokit;
}

/**
 * Create a GitHub issue in a given repo.
 */
export async function createIssue(opts: {
  repo: string; // "owner/repo"
  title: string;
  body?: string;
  labels?: string[];
}): Promise<{ number: number; url: string }> {
  const [owner, repo] = opts.repo.split('/');
  const result = await getOctokit().rest.issues.create({
    owner,
    repo,
    title: opts.title,
    body: opts.body,
    labels: opts.labels,
  });
  return { number: result.data.number, url: result.data.html_url };
}

/**
 * Get open issues from a repo (for syncing to zero-dao task queue).
 */
export async function getOpenIssues(repo: string): Promise<
  Array<{
    number: number;
    title: string;
    body: string | null;
    labels: string[];
    url: string;
  }>
> {
  const [owner, repoName] = repo.split('/');
  const result = await getOctokit().rest.issues.listForRepo({
    owner,
    repo: repoName,
    state: 'open',
    per_page: 50,
  });

  return result.data.map((issue) => ({
    number: issue.number,
    title: issue.title,
    body: issue.body,
    labels: issue.labels
      .map((l) => (typeof l === 'string' ? l : l.name || ''))
      .filter(Boolean),
    url: issue.html_url,
  }));
}

/**
 * Create a PR for a given branch.
 */
export async function createPR(opts: {
  repo: string;
  title: string;
  body: string;
  head: string;
  base?: string;
}): Promise<{ number: number; url: string }> {
  const [owner, repo] = opts.repo.split('/');
  const result = await getOctokit().rest.pulls.create({
    owner,
    repo,
    title: opts.title,
    body: opts.body,
    head: opts.head,
    base: opts.base || 'main',
  });
  return { number: result.data.number, url: result.data.html_url };
}

/**
 * Post a comment on a GitHub issue.
 */
export async function commentOnIssue(opts: {
  repo: string;
  issueNumber: number;
  body: string;
}): Promise<void> {
  const [owner, repo] = opts.repo.split('/');
  await getOctokit().rest.issues.createComment({
    owner,
    repo,
    issue_number: opts.issueNumber,
    body: opts.body,
  });
}

/**
 * Close a GitHub issue.
 */
export async function closeIssue(opts: {
  repo: string;
  issueNumber: number;
  comment?: string;
}): Promise<void> {
  const [owner, repo] = opts.repo.split('/');
  if (opts.comment) {
    await commentOnIssue({
      repo: opts.repo,
      issueNumber: opts.issueNumber,
      body: opts.comment,
    });
  }
  await getOctokit().rest.issues.update({
    owner,
    repo,
    issue_number: opts.issueNumber,
    state: 'closed',
  });
}
