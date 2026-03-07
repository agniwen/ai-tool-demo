declare module '@elevenlabs/client' {
  export interface StartSessionOptions {
    agentId?: string
    connectionType?: 'webrtc' | 'websocket'
    conversationToken?: string
    conversationUrl?: string
    dynamicVariables?: Record<string, boolean | number | string>
    inputDeviceId?: string
    onConnect?: () => void
    onDisconnect?: () => void
    onError?: (error: unknown) => void
    onMessage?: (event: unknown) => void
    onModeChange?: (event: { mode: string }) => void
    onStatusChange?: (event: { status: string }) => void
    overrides?: Record<string, unknown>
    outputDeviceId?: string
    signedUrl?: string
  }

  export class Conversation {
    static startSession(options: StartSessionOptions): Promise<Conversation>;

    endSession(): Promise<void>;
    getId(): string;
    getInputVolume(): number;
    getOutputVolume(): number;
    isOpen(): boolean;
    sendContextualUpdate(message: string): void;
    sendUserMessage(message: string): void;
    setMicMuted(muted: boolean): void;
  }
}

declare module '@elevenlabs/elevenlabs-js' {
  export class ElevenLabsClient {
    constructor(config: { apiKey?: string });

    webhooks: {
      constructEvent(rawBody: string, signature: string, webhookSecret: string): Promise<any>
    };
  }
}
