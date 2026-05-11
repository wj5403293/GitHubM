// SSE 流式请求工具（文心大模型）

import ky, {
  type KyResponse,
  type AfterResponseHook,
  type NormalizedOptions,
} from 'ky';
import { createParser, type EventSourceParser } from 'eventsource-parser';

export interface SSEOptions {
  onData: (data: string) => void;
  onEvent?: (event: unknown) => void;
  onCompleted?: (error?: Error) => void;
  onAborted?: () => void;
}

export function createSSEHook(options: SSEOptions): AfterResponseHook {
  const hook: AfterResponseHook = async (
    request: Request,
    _options: NormalizedOptions,
    response: KyResponse
  ) => {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP Error ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText.slice(0, 100);
      }
      throw new Error(errorMessage);
    }
    if (!response.body) {
      throw new Error('Response body is empty');
    }

    let completed = false;
    const finish = (error?: Error): void => {
      if (completed) return;
      completed = true;
      options.onCompleted?.(error);
    };

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf8');
    const parser: EventSourceParser = createParser({
      onEvent: (event) => {
        if (!event.data) return;
        options.onEvent?.(event);
        for (const chunk of event.data.split('\\ ')) {
          options.onData(chunk);
        }
      },
    });

    const read = (): void => {
      reader
        .read()
        .then((result) => {
          if (result.done) {
            finish();
            return;
          }
          parser.feed(decoder.decode(result.value, { stream: true }));
          read();
        })
        .catch((error) => {
          if (request.signal.aborted) {
            options.onAborted?.();
            return;
          }
          finish(error as Error);
        });
    };

    read();
    return response;
  };

  return hook;
}

export interface StreamRequestOptions {
  functionUrl: string;
  requestBody: unknown;
  supabaseAnonKey: string;
  onData: (data: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

export async function sendStreamRequest(options: StreamRequestOptions): Promise<void> {
  const { functionUrl, requestBody, supabaseAnonKey, onData, onComplete, onError, signal } = options;

  const sseHook = createSSEHook({
    onData,
    onCompleted: (error?: Error) => {
      if (error) onError(error);
      else onComplete();
    },
    onAborted: () => console.log('请求已中断'),
  });

  try {
    await ky.post(functionUrl, {
      json: requestBody,
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      signal,
      timeout: 60000,
      hooks: { afterResponse: [sseHook] },
    });
  } catch (error) {
    if (!signal?.aborted) onError(error as Error);
  }
}

/** 解析 SSE data 帧，提取文心大模型增量内容 */
export function parseWenxinChunk(data: string): string {
  if (data === '[DONE]') return '';
  try {
    const parsed = JSON.parse(data);
    return parsed.choices?.[0]?.delta?.content ?? '';
  } catch {
    return '';
  }
}
