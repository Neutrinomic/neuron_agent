import { bold, cyan, magenta } from "https://deno.land/std/fmt/colors.ts";
import { Principal } from "npm:@dfinity/principal";

/**
 * Generates a random 256-character string
 */
export function generateRandomSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(256);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < 256; i++) {
    result += chars.charAt(randomValues[i] % chars.length);
  }
  
  return result;
}

/**
 * Display title in a compact one-liner with algorithmic decoration
 */
export function displayTitle(title: string): void {
  console.log("\n" + 
    [...Array(title.length)].map((_, i) => cyan(["∿", "∾", "≈", "≋"][i % 4])).join("") + 
    " " + magenta(bold(`⚛️  ${title} ⚛️`)) + " " + 
    [...Array(title.length)].map((_, i) => cyan(["≋", "≈", "∾", "∿"][(title.length - i - 1) % 4])).join("") + 
    "\n");
}

// Create a simple SHA-256 hash function
export async function sha256(message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
} 



/**
 * Convert a Uint8Array to a hex string.
 */
function uint8ArrayToHexString(arr: Uint8Array): string {
  return Array.from(arr, byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Recursively converts special IC data types in the object `x` into plain JavaScript types 
 * for safe serialization (e.g., Principal → string, BigInt → string, Uint8Array → hex string).
 */
export function toState(x: unknown): unknown {
  // Handle null or undefined
  if (x === undefined || x === null) {
    return x;
  }
  
  // BigInt to string
  if (typeof x === "bigint") {
    return x.toString();
  }
  
  // Principal to string (textual representation)
  if (x instanceof Principal) {
    return x.toText();
  }
  
  // Uint8Array to hex string
  if (x instanceof Uint8Array) {
    return uint8ArrayToHexString(x);
  }
  
  // 16-bit and 32-bit integer arrays to plain number arrays
  if (
    x instanceof Uint16Array || x instanceof Int16Array ||
    x instanceof Uint32Array || x instanceof Int32Array
  ) {
    return Array.from(x);
  }
  
  // 64-bit BigInt typed arrays to plain string arrays
  if (x instanceof BigInt64Array) {
    return Array.from(x, elem => elem.toString());
  }
  if (x instanceof BigUint64Array) {
    return Array.from(x, elem => elem.toString());
  }
  
  // Other typed arrays or ArrayBuffer (e.g., Int8Array, Float32Array, DataView)
  if (ArrayBuffer.isView(x)) {
    if (x instanceof DataView) {
      // DataView: convert to a Uint8Array first
      const bytes = new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
      return Array.from(bytes);
    } else {
      // Int8Array, Uint8ClampedArray, Float32Array, Float64Array, etc.
      return Array.from(x as unknown as Iterable<number>);
    }
  }
  
  if (x instanceof ArrayBuffer) {
    // ArrayBuffer to array of bytes
    return Array.from(new Uint8Array(x));
  }
  
  // Arrays: recurse on each element
  if (Array.isArray(x)) {
    return x.map(item => toState(item));
  }
  
  // Objects: recurse on each property value
  if (typeof x === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(x as Record<string, unknown>)) {
      result[key] = toState(value);
    }
    return result;
  }
  
  // Primitive types (number, string, boolean, etc.) are returned as-is
  return x;
}
