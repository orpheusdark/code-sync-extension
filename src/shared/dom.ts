/**
 * Safe HTML injection to pass Mozilla AMO validation
 */
export function setHTML(element: Element | DocumentFragment, html: string): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  element.textContent = '';
  while (doc.body.firstChild) {
    element.appendChild(doc.body.firstChild);
  }
}
