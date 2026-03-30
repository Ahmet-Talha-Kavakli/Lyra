/**
 * POST /api/ai/stream
 * Streaming AI Response with Server-Sent Events (SSE)
 * Vercel Edge-compatible, ZERO timeout risk, instant response
 */

import { logger } from '../../lib/infrastructure/logger';

export const config = {
  runtime: 'edge',
  maxDuration: 300, // 5 minutes max for streaming (safety)
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
    });
  }

  try {
    const { message, userId, conversationId } = await req.json();

    if (!message || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
      });
    }

    logger.info('Stream request', { userId, conversationId });

    /**
     * CRITICAL: Stream response immediately (HTTP 200 + SSE headers)
     * Do NOT await AI response before sending back to client
     */
    const encoder = new TextEncoder();
    let streamClosed = false;

    const body = new ReadableStream({
      async start(controller) {
        try {
          // ✅ Send initial SSE header
          controller.enqueue(
            encoder.encode(':keep-alive\n\n')
          );

          // ✅ Call Anthropic/OpenAI API with streaming (non-blocking)
          const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY || '',
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 2048,
              stream: true,
              messages: [
                {
                  role: 'user',
                  content: message,
                },
              ],
            }),
          });

          if (!aiResponse.ok) {
            const error = await aiResponse.text();
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${JSON.stringify({ error })}\n\n`)
            );
            controller.close();
            return;
          }

          // ✅ Pipe AI stream to client SSE
          const reader = aiResponse.body?.getReader();
          if (!reader) {
            controller.enqueue(
              encoder.encode('event: error\ndata: {"error":"No response body"}\n\n')
            );
            controller.close();
            return;
          }

          let buffer = '';
          while (!streamClosed) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += new TextDecoder().decode(value);
            const lines = buffer.split('\n');

            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i];
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  const content = data.delta?.text || '';
                  if (content) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`)
                    );
                  }
                } catch {
                  // Ignore parse errors, continue streaming
                }
              }
            }
            buffer = lines[lines.length - 1];
          }

          // ✅ Send completion marker
          controller.enqueue(
            encoder.encode('event: done\ndata: {}\n\n')
          );
          controller.close();
        } catch (error: any) {
          logger.error('Stream controller error', { error: error.message });
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error: any) {
    logger.error('Stream handler error', { error: error.message });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
    });
  }
}
