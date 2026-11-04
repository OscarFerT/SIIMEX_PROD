import Swal from 'sweetalert2';
import DOMPurify from 'dompurify';

export function sanitizeHtml(value: string): string {
  return DOMPurify.sanitize(value, { USE_PROFILES: { html: true }, FORBID_TAGS: ['iframe', 'object', 'embed'] });
}

function safeOptions(options: Record<string, unknown>): Record<string, unknown> {
  const result = { ...options };
  for (const key of ['html', 'title', 'footer', 'iconHtml', 'confirmButtonText', 'cancelButtonText', 'denyButtonText', 'loaderHtml']) {
    if (typeof result[key] === 'string') result[key] = sanitizeHtml(result[key] as string);
  }
  return result;
}

const safeSwal = Swal.mixin({});
const fire = safeSwal.fire.bind(safeSwal) as (...args: any[]) => any;
safeSwal.fire = ((...args: any[]) => {
  if (args[0] && typeof args[0] === 'object') return fire(safeOptions(args[0]));
  return fire(...args.map((arg, index) => typeof arg === 'string' && index < 2 ? sanitizeHtml(arg) : arg));
}) as typeof Swal.fire;
const update = safeSwal.update.bind(safeSwal);
safeSwal.update = options => update(safeOptions(options));

export default safeSwal;
