import path from 'path';

export const getSafeVaultPath = (vaultPath: string) => {
  const dataDir = process.env.NODE_ENV === 'production' ? path.resolve('/tmp', 'data') : path.resolve(process.cwd(), 'data');
  // Strip leading slashes and drive letters to make it relative
  const relativePath = vaultPath.replace(/^([a-zA-Z]:)?[\/\\]+/, '').replace(/^(\.\.[\/\\])+/, '');
  const resolvedVaultPath = path.resolve(dataDir, relativePath);
  if (!resolvedVaultPath.startsWith(dataDir)) {
    throw new Error("Invalid vault path");
  }
  return resolvedVaultPath;
};
