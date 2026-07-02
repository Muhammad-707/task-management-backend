import type { FastifyRequest, FastifyReply } from 'fastify';
import * as chatService from './service.js';
import { chatHub } from './realtime.js';
import {
  SendContactRequestBodySchema,
  ContactRequestsQuerySchema,
  CreateDirectBodySchema,
  CreateGroupBodySchema,
  AddConversationMemberBodySchema,
  ListMessagesQuerySchema,
  SendMessageBodySchema,
} from './schema.js';

// ─── Contacts ───────────────────────────────────────────────────────────────

export async function sendContactRequestHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const body = SendContactRequestBodySchema.parse(request.body);
  const contact = await chatService.sendContactRequest(
    request.server.prisma,
    request.userId,
    body.user_id,
  );
  reply.code(201).send(contact);
}

export async function listContactRequestsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { direction } = ContactRequestsQuerySchema.parse(request.query);
  const requests = await chatService.listContactRequests(
    request.server.prisma,
    request.userId,
    direction,
  );
  reply.send(requests);
}

export async function acceptContactRequestHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params as { id: string };
  const contact = await chatService.respondToContactRequest(
    request.server.prisma,
    request.userId,
    id,
    true,
  );
  reply.send(contact);
}

export async function declineContactRequestHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params as { id: string };
  const contact = await chatService.respondToContactRequest(
    request.server.prisma,
    request.userId,
    id,
    false,
  );
  reply.send(contact);
}

export async function listContactsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const contacts = await chatService.listContacts(request.server.prisma, request.userId);
  reply.send(contacts);
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function createDirectHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const body = CreateDirectBodySchema.parse(request.body);
  const conversation = await chatService.createDirectConversation(
    request.server.prisma,
    request.userId,
    body.user_id,
  );
  reply.code(201).send(conversation);
}

export async function createGroupHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const body = CreateGroupBodySchema.parse(request.body);
  const conversation = await chatService.createGroupConversation(
    request.server.prisma,
    request.workspace.id,
    request.userId,
    body,
  );
  reply.code(201).send(conversation);
}

export async function addConversationMemberHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params as { id: string };
  const body = AddConversationMemberBodySchema.parse(request.body);
  await chatService.addConversationMember(request.server.prisma, request.userId, id, body.user_id);
  reply.code(204).send();
}

export async function listConversationsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const conversations = await chatService.listConversations(request.server.prisma, request.userId);
  reply.send(conversations);
}

export async function getConversationHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params as { id: string };
  const conversation = await chatService.getConversation(request.server.prisma, request.userId, id);
  reply.send(conversation);
}

export async function listMessagesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params as { id: string };
  const { cursor, limit } = ListMessagesQuerySchema.parse(request.query);
  const result = await chatService.listMessages(
    request.server.prisma,
    request.userId,
    id,
    cursor,
    limit,
  );
  reply.send(result);
}

export async function sendMessageHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params as { id: string };
  const body = SendMessageBodySchema.parse(request.body);
  const { message, memberIds } = await chatService.createMessage(
    request.server.prisma,
    request.userId,
    id,
    body.body,
  );

  // Real-time fan-out to every connected member (including the sender's other
  // devices). REST and WebSocket message creation share this same push.
  chatHub.broadcast(memberIds, { type: 'message', data: message });

  reply.code(201).send(message);
}
