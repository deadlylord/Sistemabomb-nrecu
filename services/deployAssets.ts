// Pin staging's compiled modules to the immutable deploy that built them.
// Opening a new module in an old tab must not ask the latest deploy for old hashes.
export function deployAssetBase(env: Record<string, string | undefined>): string {
  if (env.NETLIFY !== 'true' || !['branch-deploy', 'deploy-preview'].includes(env.CONTEXT || '')) return '/';
  const deployUrl = env.DEPLOY_URL || '';
  if (!/^https:\/\/[a-f0-9]{24}--[a-z0-9-]+\.netlify\.app\/?$/i.test(deployUrl)) {
    throw new Error('Netlify staging requires a valid immutable DEPLOY_URL.');
  }
  return `${deployUrl.replace(/\/$/, '')}/`;
}
