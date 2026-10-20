import { PassThrough, Readable } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import { type EntryContext, ServerRouter } from 'react-router';

// The site is prerendered, never served at runtime, so this only runs at build
// time. It waits for the whole tree (onAllReady), so every page's HTML is
// complete: no streamed Suspense chunks and no inline scripts to patch them in.
export const streamTimeout = 5_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let status = responseStatusCode;
    const timeout = setTimeout(() => abort(), streamTimeout + 1_000);

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onAllReady() {
          clearTimeout(timeout);
          const body = new PassThrough();
          responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
          resolve(new Response(Readable.toWeb(body) as ReadableStream, { headers: responseHeaders, status }));
          pipe(body);
        },
        onShellError(error: unknown) {
          clearTimeout(timeout);
          reject(error);
        },
        onError(error: unknown) {
          status = 500;
          console.error(error);
        },
      },
    );
  });
}
