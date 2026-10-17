// Keep bundles and manifest on the origin used to open the application.
// Immutable deploy URLs can be protected or redirected by Netlify and fail CORS.
export function deployAssetBase(_env: Record<string, string | undefined>): string {
  return '/';
}
