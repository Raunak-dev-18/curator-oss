type PublishedAppFrameProps = {
  title: string;
  runtimeUrl: string;
};

export function PublishedAppFrame({ title, runtimeUrl }: PublishedAppFrameProps) {
  return (
    <main className="published-app-shell">
      <iframe
        title={title}
        src={runtimeUrl}
        allow="camera; clipboard-read; clipboard-write; display-capture; fullscreen; geolocation; microphone"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <noscript>This published app requires JavaScript.</noscript>
    </main>
  );
}
