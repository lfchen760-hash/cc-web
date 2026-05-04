import type { AllMessage, ChatMessage } from "../../types";
import { useMessageConverter } from "../useMessageConverter";

export interface StreamingContext {
  currentAssistantMessage: ChatMessage | null;
  setCurrentAssistantMessage: (msg: ChatMessage | null) => void;
  addMessage: (msg: AllMessage) => void;
  updateLastMessage: (content: string) => void;
  onSessionId?: (sessionId: string) => void;
  shouldShowInitMessage?: () => boolean;
  onInitMessageShown?: () => void;
  hasReceivedInit?: boolean;
  setHasReceivedInit?: (received: boolean) => void;
  onPermissionError?: (
    toolName: string,
    patterns: string[],
    toolUseId: string,
  ) => void;
  onAbortRequest?: () => void;
  onTokenUsage?: (usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; costUSD: number; contextWindow: number }) => void;
  onPermissionDenied?: (denials: Array<{ tool_name: string; tool_use_id: string; tool_input: Record<string, unknown> }>) => void;
  onTaskProgress?: (progress: {
    description: string;
    totalTokens: number;
    toolUses: number;
    durationMs: number;
    lastToolName: string;
  }) => void;
  onModel?: (model: string) => void;
}

/**
 * Hook that provides message processing functions for streaming context.
 * Now delegates to the unified message converter for consistency.
 */
export function useMessageProcessor() {
  const converter = useMessageConverter();

  return {
    // Delegate to unified converter
    createSystemMessage: converter.createSystemMessage,
    createToolMessage: converter.createToolMessage,
    createResultMessage: converter.createResultMessage,
    createToolResultMessage: converter.createToolResultMessage,
    createThinkingMessage: converter.createThinkingMessage,
    convertTimestampedSDKMessage: converter.convertTimestampedSDKMessage,
    convertConversationHistory: converter.convertConversationHistory,
  };
}
