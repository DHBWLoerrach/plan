/* Marks a link that leaves the application. The icon is bound to the last word so that it never wraps onto a line of its
   own; the link text names the destination, so screen readers skip the icon. One element around all of it keeps the
   space before the last word inside a flex container. */
export function ExternalLinkText({ children }: { children: string }) {
  const split = children.lastIndexOf(" ") + 1;
  return <span>
    {children.slice(0, split)}
    <span className="external-link-text">
      {children.slice(split)}
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 18 18 6M8 6h10v10" /></svg>
    </span>
  </span>;
}
