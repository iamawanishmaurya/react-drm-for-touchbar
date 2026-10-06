import dbus from 'dbus-next';
import { createLogger } from 'react-drm';

const log = createLogger('dbus');

// dbus-next opens its socket lazily: sessionBus()/systemBus() return a handle
// synchronously and the SASL handshake happens later, on the socket's 'connect'
// event. A peer that closes the connection first — the case when the bar runs as
// root against the desktop user's session bus, where EXTERNAL auth is rejected
// for the uid mismatch — therefore surfaces as an 'error' event on the bus, long
// after any `try { dbus.sessionBus() } catch` has already returned.
//
// With no listener attached, Node re-emits that as an uncaughtException, which is
// how a background feature (active-window detection, battery polling) ends up in
// the journal as `uncaught exception (process survived): Error: write EPIPE`.
// Attaching the handler here makes a dead bus a one-line warning instead.
export function openBus(kind: 'session' | 'system', label: string): dbus.MessageBus {
  const bus = kind === 'session' ? dbus.sessionBus() : dbus.systemBus();
  bus.on('error', e => {
    const err = e as Error & { code?: string };
    log.warn(`${label}: ${kind} bus failed — ${err.code ?? ''} ${err.message}`.trim());
  });
  return bus;
}