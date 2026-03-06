export function isDeveloperModeEnabled() {
  return process.env.NODE_ENV === 'development'
    || process.env.DEV_MODE === 'true'
    || process.env.NEXT_PUBLIC_DEV_MODE === 'true';
}
