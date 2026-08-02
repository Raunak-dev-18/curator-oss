import { ArrowLeft, MonitorUp } from "lucide-react";

export function PreviewPlaceholder() {
  return (
    <div className="preview-placeholder">
      <div className="preview-empty-state">
        <span><MonitorUp className="size-5" /></span>
        <h2>Your preview will appear here</h2>
        <p>Send a build prompt in the chat. Cognix will create the app, start its development server, and connect the live preview.</p>
        <small><ArrowLeft className="size-3.5" /> Start with a clear description of the first screen</small>
      </div>
    </div>
  );
}
