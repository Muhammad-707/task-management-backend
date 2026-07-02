import { z } from 'zod';
import type { FastifySchema } from 'fastify';

// ─── Zod validators ───────────────────────────────────────────────────────────

export const SendContactRequestBodySchema = z.object({
  user_id: z.string().uuid(),
});

export const ContactRequestsQuerySchema = z.object({
  direction: z.enum(['incoming', 'outgoing']).default('incoming'),
});

export const CreateDirectBodySchema = z.object({
  user_id: z.string().uuid(),
});

export const CreateGroupBodySchema = z.object({
  name: z.string().min(1).max(100),
  member_ids: z.array(z.string().uuid()).min(1).max(200),
});

export const AddConversationMemberBodySchema = z.object({
  user_id: z.string().uuid(),
});

export const ListMessagesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const SendMessageBodySchema = z.object({
  body: z.string().min(1).max(10_000),
});

/** Inbound WebSocket frame the client can send to post a message over the socket. */
export const WsSendFrameSchema = z.object({
  type: z.literal('send'),
  conversation_id: z.string().uuid(),
  body: z.string().min(1).max(10_000),
});

export type SendContactRequestBody = z.infer<typeof SendContactRequestBodySchema>;
export type ContactRequestsQuery = z.infer<typeof ContactRequestsQuerySchema>;
export type CreateDirectBody = z.infer<typeof CreateDirectBodySchema>;
export type CreateGroupBody = z.infer<typeof CreateGroupBodySchema>;
export type AddConversationMemberBody = z.infer<typeof AddConversationMemberBodySchema>;
export type ListMessagesQuery = z.infer<typeof ListMessagesQuerySchema>;
export type SendMessageBody = z.infer<typeof SendMessageBodySchema>;

// ─── Fastify route schemas ────────────────────────────────────────────────────
//
// Bodies/params/querystrings are validated here (and again by Zod in the
// controller for typed access). Response schemas are intentionally omitted for
// list/detail endpoints so Fastify's serializer doesn't strip the nested
// user/last-message objects.

const security = [{ bearerAuth: [] }];

export const sendContactRequestSchema: FastifySchema = {
  tags: ['Chat'],
  summary: 'Send a contact (friend) request',
  security,
  body: {
    type: 'object',
    required: ['user_id'],
    properties: { user_id: { type: 'string', format: 'uuid' } },
  },
};

export const listContactRequestsSchema: FastifySchema = {
  tags: ['Chat'],
  summary: 'List pending contact requests (incoming or outgoing)',
  security,
  querystring: {
    type: 'object',
    properties: { direction: { type: 'string', enum: ['incoming', 'outgoing'] } },
  },
};

export const respondContactRequestSchema: FastifySchema = {
  tags: ['Chat'],
  summary: 'Accept or decline a contact request',
  security,
  params: { type: 'object', properties: { id: { type: 'string' } } },
};

export const listContactsSchema: FastifySchema = {
  tags: ['Chat'],
  summary: 'List accepted contacts',
  security,
};

export const createDirectSchema: FastifySchema = {
  tags: ['Chat'],
  summary: 'Open (or find) a 1:1 conversation with a contact',
  security,
  body: {
    type: 'object',
    required: ['user_id'],
    properties: { user_id: { type: 'string', format: 'uuid' } },
  },
};

export const createGroupSchema: FastifySchema = {
  tags: ['Chat'],
  summary: 'Create a workspace group conversation',
  security,
  params: { type: 'object', properties: { workspaceSlug: { type: 'string' } } },
  body: {
    type: 'object',
    required: ['name', 'member_ids'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      member_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1 },
    },
  },
};

export const addConversationMemberSchema: FastifySchema = {
  tags: ['Chat'],
  summary: 'Add a member to a group conversation',
  security,
  params: { type: 'object', properties: { id: { type: 'string' } } },
  body: {
    type: 'object',
    required: ['user_id'],
    properties: { user_id: { type: 'string', format: 'uuid' } },
  },
};

export const listConversationsSchema: FastifySchema = {
  tags: ['Chat'],
  summary: 'List the authenticated user conversations (with last message)',
  security,
};

export const getConversationSchema: FastifySchema = {
  tags: ['Chat'],
  summary: 'Get a conversation with its members',
  security,
  params: { type: 'object', properties: { id: { type: 'string' } } },
};

export const listMessagesSchema: FastifySchema = {
  tags: ['Chat'],
  summary: 'List messages in a conversation (cursor pagination, newest first)',
  security,
  params: { type: 'object', properties: { id: { type: 'string' } } },
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string', format: 'uuid' },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
  },
};

export const sendMessageSchema: FastifySchema = {
  tags: ['Chat'],
  summary: 'Post a message to a conversation',
  security,
  params: { type: 'object', properties: { id: { type: 'string' } } },
  body: {
    type: 'object',
    required: ['body'],
    properties: { body: { type: 'string', minLength: 1, maxLength: 10000 } },
  },
};
