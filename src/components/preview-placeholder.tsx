import { ArrowLeft, LoaderCircle, MonitorUp } from "lucide-react";

export function PreviewPlaceholder({ reconnecting = false }: { reconnecting?: boolean }) {
  return (
    <div className="preview-placeholder">
      <div className="preview-empty-state">
        <span>{reconnecting ? <LoaderCircle className="size-5 animate-spin" /> : <MonitorUp className="size-5" />}</span>
        <h2>{reconnecting ? "Starting live preview" : "Your preview will appear here"}</h2>
        <p>
          {reconnecting
            ? "Cognix is waking the sandbox, starting the app, and reconnecting the live preview."
            : "Send a build prompt in the chat. Cognix will create the app, start its development server, and connect the live preview."}
        </p>
        <small><ArrowLeft className="size-3.5" /> {reconnecting ? "This runs automatically when you open a built project" : "Start with a clear description of the first screen"}</small>
      </div>
    </div>
  );
}
