// Convert 64bits Unsigned Int to Bytes Array
export function toBytesInt64 (num: number) {
    const arr = new Uint8Array([
        (num & 0xff00000000000000) >> 56,
         (num & 0x00ff000000000000) >> 48,
         (num & 0x0000ff0000000000) >> 40,
         (num & 0x000000ff00000000) >> 32,
         (num & 0x00000000ff000000) >> 24,
         (num & 0x0000000000ff0000) >> 16,
         (num & 0x000000000000ff00) >> 8,
         (num & 0x00000000000000ff)
    ]);
    return arr;
}

// Convert Bytes Array to 64bit Unsigned Int
export function toInt64Bytes (bytes: Uint8Array) {
    return ((bytes[0] << 56) + (bytes[1] << 48) + (bytes[2] << 40) + (bytes[3] << 32) +
        (bytes[4] << 24) + (bytes[5] << 16) + (bytes[6] << 8) + bytes[7])
}

// Check if file exists and return Boolean
export const exists = async (filename: string): Promise<boolean> => {
    try {
      await Deno.stat(filename);
      // successful, file or directory must exist
      return true;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        // file or directory does not exist
        return false;
      } else {
        // unexpected error, maybe permissions, pass it along
        throw error;
      }
    }
  };
  
// Encoder, Decoder
export const encoder = new TextEncoder()
export const decoder = new TextDecoder()