export function githubMcpTools() {
  return [
    'listRepositories',
    'readFile',
    'createFile',
    'updateFile',
    'createCommit'
  ];
}

export function isGithubConfigured() {
  return Boolean(process.env.GITHUB_TOKEN);
}
