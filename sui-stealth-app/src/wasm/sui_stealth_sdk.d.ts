/* tslint:disable */
/* eslint-disable */

/**
 * Check if an announcement belongs to this receiver
 * Returns JSON string
 */
export function checkStealthAddress(stealth_address: string, ephemeral_public_key_hex: string, view_tag: number, view_private_key_hex: string, spend_public_key_hex: string): string;

/**
 * Derive the stealth private key (receiver side)
 * Returns JSON string
 */
export function computeStealthPrivateKey(spend_private_key_hex: string, hashed_shared_secret_hex: string): string;

/**
 * Derive view and spend keys from a signature
 * Returns JSON string: { "viewPrivateKey": "...", "spendPrivateKey": "..." }
 */
export function deriveKeysFromSignature(signature_hex: string): string;

/**
 * Derive stealth meta-address from private keys
 * Returns JSON string
 */
export function deriveStealthMetaAddress(view_private_key_hex: string, spend_private_key_hex: string): string;

/**
 * Generate a stealth address for a recipient (sender side)
 * Returns JSON string
 */
export function generateStealthAddress(view_public_key_hex: string, spend_public_key_hex: string): string;

/**
 * Initialize panic hook for better error messages in browser console
 */
export function init(): void;

/**
 * Sign a message with a Sui private key
 * Returns hex-encoded 64-byte signature
 */
export function signMessage(sui_private_key: string, message: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly checkStealthAddress: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number, number];
    readonly computeStealthPrivateKey: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly deriveKeysFromSignature: (a: number, b: number) => [number, number, number, number];
    readonly deriveStealthMetaAddress: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly generateStealthAddress: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly signMessage: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly init: () => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
