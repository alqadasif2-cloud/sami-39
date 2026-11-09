import fs from 'fs';
import path from 'path';

export interface GitHubVaultData {
  owner: string;
  repo: string;
  token?: string;
  apiServerUrl?: string;
  updatedAt: number;
  updatedBy: string;
}

const VAULT_FILE = path.resolve('data/github_vault.json');

export function loadGitHubVault(): GitHubVaultData | null {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      return JSON.parse(fs.readFileSync(VAULT_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('[GitHub Vault] Error reading vault:', err);
  }
  return null;
}

export async function saveGitHubCredentialsToVault(params: {
  owner: string;
  repo: string;
  token?: string;
  apiServerUrl?: string;
  updatedBy: string;
}): Promise<{ owner: string; repo: string; vault: GitHubVaultData }> {
  const existing = loadGitHubVault();
  const dir = path.dirname(VAULT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const updated: GitHubVaultData = {
    owner: params.owner || existing?.owner || process.env.GITHUB_OWNER || '',
    repo: params.repo || existing?.repo || process.env.GITHUB_REPO || '',
    token: params.token || existing?.token || process.env.GITHUB_TOKEN || '',
    apiServerUrl: params.apiServerUrl || existing?.apiServerUrl || '',
    updatedAt: Date.now(),
    updatedBy: params.updatedBy,
  };

  fs.writeFileSync(VAULT_FILE, JSON.stringify(updated, null, 2), 'utf-8');

  return {
    owner: updated.owner,
    repo: updated.repo,
    vault: {
      ...updated,
      token: updated.token ? '***CONFIGURED***' : undefined,
    },
  };
}
