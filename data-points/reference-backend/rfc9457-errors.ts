import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    message: string,
    public readonly type = "about:blank",
  ) {
    super(message);
  }
}

export function notFound(request: Request, response: Response) {
  response.status(404).type("application/problem+json").json({
    type: "about:blank",
    title: "Not Found",
    status: 404,
    detail: "The requested resource does not exist.",
    instance: request.originalUrl,
    requestId: request.requestId,
  });
}

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "body";
      (errors[key] ??= []).push(issue.message);
    }
    return response.status(400).type("application/problem+json").json({
      type: "https://pgkhata.com/problems/validation",
      title: "Validation failed",
      status: 400,
      detail: "The request body is invalid.",
      instance: request.originalUrl,
      requestId: request.requestId,
      errors,
    });
  }

  const apiError = error instanceof ApiError ? error : null;
  if (!apiError) request.log?.error({ err: error }, "Unhandled request error");
  const status = apiError?.status ?? 500;
  return response
    .status(status)
    .type("application/problem+json")
    .json({
      type: apiError?.type ?? "about:blank",
      title: apiError?.title ?? "Internal Server Error",
      status,
      detail: apiError?.message ?? "An unexpected error occurred.",
      instance: request.originalUrl,
      requestId: request.requestId,
    });
}
