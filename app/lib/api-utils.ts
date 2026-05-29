import { NextResponse } from "next/server";

export function withErrorHandler(
  handler: (...args: any[]) => Promise<Response>,
  context: string
): (...args: any[]) => Promise<Response> {
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error(`Error in ${context}:`, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

export function missingEnvError(variable: string) {
  return NextResponse.json(
    { error: `Missing environment variable: ${variable}` },
    { status: 500 }
  );
}

export async function makeFetch(
  url: string,
  options: RequestInit & { timeout?: number } = {},
  timeout = 10000
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
