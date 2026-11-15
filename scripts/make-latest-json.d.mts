// Types de scripts/make-latest-json.mjs, pour les tests Vitest (TypeScript strict).

export declare const REPOSITORY: string;
export declare const PLATFORM: string;
export declare const DEFAULT_BUNDLE_DIR: string;
export declare const DEFAULT_OUT_DIR: string;

export declare class ReleaseError extends Error {}

export interface AppConfig {
  version: string;
  productName: string;
  pubkey: string;
  endpoint: string;
}

export interface LatestJson {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<string, { signature: string; url: string }>;
}

export declare function readAppConfig(rootDir: string): AppConfig;
export declare function versionFromTag(tag: string): string;
export declare function installerFileName(productName: string, version: string): string;
export declare function releaseDownloadUrl(repo: string, tag: string, fileName: string): string;
export declare function defaultNotes(repo: string, tag: string): string;
export declare function rfc3339(date: Date): string;
export declare function buildLatestJson(input: {
  version: string;
  notes: string;
  pubDate: string;
  signature: string;
  url: string;
}): LatestJson;
export declare function parsePublicKey(pubkeyB64: string): { keyId: Uint8Array; key: Uint8Array };
export declare function parseSignature(sigB64: string): {
  algorithm: string;
  keyId: Uint8Array;
  signature: Uint8Array;
  trustedComment: string;
  globalSignature: Uint8Array;
};
export declare function trustedCommentFields(trustedComment: string): Record<string, string>;
export declare function verifySignature(data: Uint8Array, sigB64: string, pubkeyB64: string): Record<string, string>;
export declare function findInstaller(files: string[], productName: string, version: string): string;
export declare function prepareRelease(input: {
  rootDir: string;
  tag: string;
  bundleDir: string;
  outDir: string;
  now?: Date;
  repo?: string;
}): { latest: LatestJson; installer: string; files: string[]; warnings: string[] };
export declare function checkLatestJson(
  latest: unknown,
  expected: { version: string; url: string; signature?: string },
  source: string,
): { signature: string; url: string };
export declare function verifyPublishedRelease(input: {
  rootDir: string;
  tag: string;
  repo?: string;
  expectedSignature?: string;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  attempts?: number;
  delayMs?: number;
  wait?: (ms: number) => Promise<void>;
}): Promise<{ version: string; url: string }>;
export declare function main(argv: string[], rootDir?: string): Promise<void>;
