// Real-time chat fan-out hub.
//
// An in-process registry mapping a userId to the set of live WebSocket
// connections that user currently has open (multiple tabs/devices → multiple
// sockets). When a message is created — via REST or over the socket itself — we
// look up every recipient's sockets and push the event to each.
//
// This is deliberately behind a small interface so a horizontally-scaled
// deployment can swap the in-process map for a Redis pub/sub backend without
// touching call sites: publish on message-create, and each node forwards to its
// locally-connected sockets.

import type { WebSocket } from '@fastify/websocket';

/** An event pushed to clients. `type: "message"` carries a serialized message. */
export interface OutboundEvent {
  type: 'message' | 'error';
  data: unknown;
}

export interface ChatHub {
  register(userId: string, socket: WebSocket): void;
  unregister(userId: string, socket: WebSocket): void;
  /** Push an event to every live socket of each given user (deduplicated). */
  broadcast(userIds: string[], event: OutboundEvent): void;
}

class InProcessChatHub implements ChatHub {
  private readonly byUser = new Map<string, Set<WebSocket>>();

  register(userId: string, socket: WebSocket): void {
    let sockets = this.byUser.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.byUser.set(userId, sockets);
    }
    sockets.add(socket);
  }

  unregister(userId: string, socket: WebSocket): void {
    const sockets = this.byUser.get(userId);
    if (!sockets) return;
    sockets.delete(socket);
    if (sockets.size === 0) this.byUser.delete(userId);
  }

  broadcast(userIds: string[], event: OutboundEvent): void {
    const payload = JSON.stringify(event);
    for (const userId of new Set(userIds)) {
      const sockets = this.byUser.get(userId);
      if (!sockets) continue;
      for (const socket of sockets) {
        // ws readyState 1 === OPEN
        if (socket.readyState === 1) socket.send(payload);
      }
    }
  }
}

/** Process-wide singleton. Swap the implementation for Redis in production. */
export const chatHub: ChatHub = new InProcessChatHub();
