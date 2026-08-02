import { ZodError } from "zod";

export function errorResponse(error: unknown) {
  if (error instanceof Response) return error;
  if (error instanceof ZodError) {
    return Response.json(
      { error: "Check the highlighted fields and try again.", details: error.flatten() },
      { status: 400 },
    );
  }
  const message = error instanceof Error ? error.message : "Something went wrong. Try again.";
  return Response.json({ error: message }, { status: 500 });
}

export function notFound(message = "This project was not found or you no longer have access.") {
  return Response.json({ error: message }, { status: 404 });
}

