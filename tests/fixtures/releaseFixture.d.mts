// Types de tests/fixtures/releaseFixture.mjs.

export declare const REPO_ROOT: string;

export interface KeyPair {
  pubkey: string;
}

export interface FakeRelease {
  root: string;
  bundleDir: string;
  outDir: string;
  installer: string;
  bytes: Uint8Array<ArrayBuffer>;
  signature: string;
  pubkey: string;
  keys: KeyPair;
}

export declare function makeKeyPair(): KeyPair;
export declare function makeSignature(keys: KeyPair, data: Uint8Array, comment?: { file?: string; version?: string }): string;
export declare function makeRelease(options?: {
  version?: string;
  productName?: string;
  installerVersion?: string;
  sig?: 'valid' | 'missing' | 'empty' | 'other-key' | 'tampered';
  signedVersion?: string | null;
  signedFile?: string;
}): FakeRelease;
export declare function readText(path: string): string;
export declare function listDir(path: string): string[];
export declare function writeText(path: string, text: string): void;
export declare function removeDir(path: string): void;
export declare function joinPath(...parts: string[]): string;
