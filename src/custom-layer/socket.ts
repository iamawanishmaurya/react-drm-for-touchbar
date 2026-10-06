import os from 'node:os';
import path from 'node:path';

/**
 * Local-only IPC between config-gui's main process and the Touch Bar
 * process's Custom Layer bridge — a Unix domain socket rather than a TCP
 * port, since neither side needs to be reachable off-machine. XDG_RUNTIME_DIR
 * is per-user and tmpfs-backed (cleaned up on logout); os.tmpdir() covers
 * environments where it isn't set.
 */
export function customLayerSocketPath(): string {
  const runtimeDir = process.env.XDG_RUNTIME_DIR || os.tmpdir();
  // A preview instance (browser preview, touchbar-control's sandbox) gets its
  // own socket: sharing the path let every preview start unlink and take over
  // the real bar's socket, cutting config-gui off from the physical bar.
  if (process.env.REACT_DRM_BACKEND === 'preview') {
    return path.join(runtimeDir, `react-drm-custom-layer-preview-${process.env.REACT_DRM_PREVIEW_PORT || '8787'}.sock`);
  }
  return path.join(runtimeDir, 'react-drm-custom-layer.sock');
}

/** Encodes one message as a newline-delimited JSON frame. */
export function encodeMessage(message: unknown): string {
  return `${JSON.stringify(message)}\n`;
}

/**
 * Buffers arbitrary chunk boundaries back into whole newline-delimited JSON
 * messages. Returns a function to feed chunks into; parsed messages are
 * reported via onMessage as they complete. Malformed lines are dropped
 * rather than tearing down the connection.
 */
export function createMessageReader<T>(onMessage: (message: T) => void): (chunk: Buffer | string) => void {
  let buffer = '';
  return (chunk: Buffer | string) => {
    buffer += chunk.toString('utf8');
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;
      try {
        onMessage(JSON.parse(line) as T);
      } catch {
        // Ignore a malformed frame rather than dropping the connection.
      }
    }
  };
}
