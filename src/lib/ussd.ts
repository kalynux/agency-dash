/**
 * A USSD code as a `tel:` link.
 *
 * `#` has to be percent-encoded: left bare it starts the URI's fragment, so
 * `tel:#150*50#` reaches the dialer as an empty number. `*` is legal as it is.
 *
 * On Android the link needs no plugin: Capacitor's WebView client hands a `tel:`
 * navigation to the system as `ACTION_VIEW`, which opens the dialer with the code
 * filled in. The payer still presses call, so no permission is involved.
 */
export function ussdTelHref(code: string): string {
  return `tel:${encodeURIComponent(code.trim())}`;
}
