import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { getInterviewReport, saveInterviewReport } from '@/lib/interview-report-store';
import { factory } from '@/server/factory';

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export const interviewRouter = factory.createApp()
  .get('/token', async (c) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID || process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

    if (!apiKey || !agentId) {
      return c.json(
        {
          error: 'Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID in environment variables.',
        },
        500,
      );
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      {
        headers: {
          'xi-api-key': apiKey,
        },
        method: 'GET',
      },
    );

    if (!response.ok) {
      const bodyText = await response.text();

      return c.json(
        {
          error: 'Failed to generate conversation token.',
          detail: bodyText,
          upstreamStatus: response.status,
        },
        500,
      );
    }

    const data = (await response.json()) as {
      token: string
    };

    return c.json({ token: data.token });
  })
  .post('/webhook', async (c) => {
    const rawBody = await c.req.raw.text();
    const signature = c.req.header('elevenlabs-signature') ?? '';
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;

    let event: any;

    try {
      if (webhookSecret) {
        event = await elevenlabs.webhooks.constructEvent(rawBody, signature, webhookSecret);
      }
      else {
        event = JSON.parse(rawBody);
      }
    }
    catch {
      return c.json({ error: 'Invalid webhook payload or signature.' }, 401);
    }

    if (event?.type !== 'post_call_transcription' || !event?.data) {
      return c.json({ received: true });
    }

    const transcript = Array.isArray(event.data.transcript)
      ? event.data.transcript
          .filter((turn: any) => turn?.role === 'agent' || turn?.role === 'user')
          .map((turn: any) => ({
            role: turn.role,
            message: typeof turn.message === 'string' ? turn.message : '',
            timeInCallSecs:
              typeof turn.time_in_call_secs === 'number' ? turn.time_in_call_secs : undefined,
          }))
      : [];

    saveInterviewReport({
      conversationId: event.data.conversation_id,
      agentId: event.data.agent_id,
      status: event.data.status,
      callSuccessful: event.data.analysis?.call_successful,
      transcriptSummary: event.data.analysis?.transcript_summary,
      evaluationCriteriaResults: event.data.analysis?.evaluation_criteria_results ?? {},
      dataCollectionResults: event.data.analysis?.data_collection_results ?? {},
      transcript,
      receivedAt: Date.now(),
    });

    return c.json({ received: true });
  })
  .get('/report/:conversationId', async (c) => {
    const conversationId = c.req.param('conversationId');
    const report = getInterviewReport(conversationId);

    if (!report) {
      return c.json({ error: 'Report not ready.' }, 404);
    }

    return c.json(report);
  });
