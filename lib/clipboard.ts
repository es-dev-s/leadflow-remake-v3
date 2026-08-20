/**
 * Copy text to the clipboard.
 *
 * `navigator.clipboard` is only available in a secure context (HTTPS or
 * localhost). Public HTTP hosts need a fallback via `document.execCommand`.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Clipboard is not available");
  }

  if (canUseClipboardApi()) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Permission denied or insecure context — try the legacy path.
    }
  }

  if (copyWithExecCommand(text)) return;
  throw new Error("Could not copy to clipboard");
}

function canUseClipboardApi(): boolean {
  return Boolean(window.isSecureContext && navigator.clipboard?.writeText);
}

function copyWithExecCommand(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;margin:0;border:0;outline:none;box-shadow:none;background:transparent;opacity:0;";
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previousRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  } finally {
    textarea.remove();
    if (previousRange && selection) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }
  }
  return ok;
}
