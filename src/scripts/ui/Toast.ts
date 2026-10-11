/** Small transient status messages, announced politely to screen readers. */
export class Toast {
  private static region(): HTMLElement | null {
    return document.querySelector('[data-toast-region]');
  }

  /** `html` must be trusted, build-time copy (never user input). */
  static show(html: string, duration = 2600): void {
    const region = Toast.region();
    if (!region) return;
    const toast = document.createElement('p');
    toast.className = 'toast';
    toast.innerHTML = html;
    region.append(toast);
    window.setTimeout(() => {
      toast.classList.add('is-leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
      window.setTimeout(() => toast.remove(), 600);
    }, duration);
  }
}
