import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function UserMessageContent({ content }: { content: string }) {
  return <div className="plain-message-content">{content}</div>;
}

export function AssistantMessageContent({ content }: { content: string }) {
  return (
    <div className="markdown-message">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
