/**
 * @fileoverview Costanti e Magic Strings centralizzate per il Core Engine.
 */

export const MCP_TOOL_NAMES = {
  READ_MARKDOWN: 'read_markdown_file',
  WRITE_MARKDOWN: 'write_markdown_file',
  LIST_DIRECTORY: 'list_directory'
} as const;

export const API_ENDPOINTS = {
  OBSIDIAN_READ: '/api/obsidian/read',
  OBSIDIAN_WRITE: '/api/obsidian/write',
  OBSIDIAN_LIST: '/api/obsidian/list',
} as const;

export const ERROR_MESSAGES = {
  NODE_EXECUTION_NOT_IMPLEMENTED: 'Esecuzione diretta in Node.js non ancora implementata in questo adapter',
  TOOL_NOT_FOUND: 'non trovato nel registro MCP',
} as const;
