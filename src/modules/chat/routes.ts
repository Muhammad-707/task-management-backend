import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { authenticate } from '../../plugins/auth-hook.js';
import { requireWorkspaceMember } from '../../plugins/workspace-hook.js';
import { verifyAccessToken } from '../../lib/jwt.js';
import { chatHub } from './realtime.js';
import * as chatService from './service.js';
import { WsSendFrameSchema } from './schema.js';
import {
  sendContactRequestSchema,
  listContactRequestsSchema,
  respondContactRequestSchema,
  listContactsSchema,
  createDirectSchema,
  createGroupSchema,
  addConversationMemberSchema,
  listConversationsSchema,
  getConversationSchema,
  listMessagesSchema,
  sendMessageSchema,
} from './schema.js';
import {
  sendContactRequestHandler,
  listContactRequestsHandler,
  acceptContactRequestHandler,
  declineContactRequestHandler,
  listContactsHandler,
  createDirectHandler,
  createGroupHandler,
  addConversationMemberHandler,
  listConversationsHandler,
  getConversationHandler,
  listMessagesHandler,
  sendMessageHandler,
} from './controller.js';

/** Contacts — `/api/v1/contacts`. Auth only (not workspace-scoped). */
export async function contactRoutes(app: FastifyInstance): Promise<void> {
  const auth = [authenticate];

  app.post(
    '/requests',
    { schema: sendContactRequestSchema, preHandler: auth },
    sendContactRequestHandler,
  );
  app.get(
    '/requests',
    { schema: listContactRequestsSchema, preHandler: auth },
    listContactRequestsHandler,
  );
  app.post(
    '/requests/:id/accept',
    { schema: respondContactRequestSchema, preHandler: auth },
    acceptContactRequestHandler,
  );
  app.post(
    '/requests/:id/decline',
    { schema: respondContactRequestSchema, preHandler: auth },
    declineContactRequestHandler,
  );
  app.get('/', { schema: listContactsSchema, preHandler: auth }, listContactsHandler);
}

/** Conversations — `/api/v1/conversations`. Auth only. */
export async function conversationRoutes(app: FastifyInstance): Promise<void> {
  const auth = [authenticate];

  app.post('/direct', { schema: createDirectSchema, preHandler: auth }, createDirectHandler);
  app.get('/', { schema: listConversationsSchema, preHandler: auth }, listConversationsHandler);
  app.get('/:id', { schema: getConversationSchema, preHandler: auth }, getConversationHandler);
  app.post(
    '/:id/members',
    { schema: addConversationMemberSchema, preHandler: auth },
    addConversationMemberHandler,
  );
  app.get('/:id/messages', { schema: listMessagesSchema, preHandler: auth }, listMessagesHandler);
  app.post('/:id/messages', { schema: sendMessageSchema, preHandler: auth }, sendMessageHandler);
}

/** Group creation — `/api/v1/workspaces/:workspaceSlug/conversations`. Workspace-scoped. */
export async function workspaceConversationRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/',
    { schema: createGroupSchema, preHandler: [authenticate, requireWorkspaceMember()] },
    createGroupHandler,
  );
}

/**
 * Real-time chat socket — `/api/v1/ws/chat?token=<access_token>`.
 *
 * The access token travels in the query string because browsers cannot set
 * custom headers on a WebSocket handshake. On connect we register the socket in
 * the hub keyed by userId; every message created (here or via REST) is pushed to
 * all connected members. Clients may also post via `{ type: "send", ... }`.
 */
export async function chatWsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/chat', { websocket: true }, (socket, req) => {
    const token = (req.query as { token?: string }).token;
    let userId: string;
    try {
      if (!token) throw new Error('missing token');
      userId = verifyAccessToken(token).sub;
    } catch {
      socket.send(JSON.stringify({ type: 'error', data: { message: 'unauthorized' } }));
      socket.close(1008, 'unauthorized');
      return;
    }

    chatHub.register(userId, socket);

    socket.on('message', (raw: Buffer) => {
      void handleInboundFrame(app, userId, socket, raw.toString());
    });

    socket.on('close', () => {
      chatHub.unregister(userId, socket);
    });
  });
}

/** Handle an inbound `{ type: "send", conversation_id, body }` frame. */
async function handleInboundFrame(
  app: FastifyInstance,
  userId: string,
  socket: WebSocket,
  raw: string,
): Promise<void> {
  try {
    const parsed = WsSendFrameSchema.parse(JSON.parse(raw));
    const { message, memberIds } = await chatService.createMessage(
      app.prisma,
      userId,
      parsed.conversation_id,
      parsed.body,
    );
    chatHub.broadcast(memberIds, { type: 'message', data: message });
  } catch (err) {
    const messageText =
      err instanceof Error ? err.message : 'Invalid frame (expected { type: "send", ... })';
    if (socket.readyState === 1) {
      socket.send(JSON.stringify({ type: 'error', data: { message: messageText } }));
    }
  }
}
