if (!customElements.get('drop-countdown')) {
  customElements.define(
    'drop-countdown',
    class extends HTMLElement {
      connectedCallback() {
        this.end = Date.parse(this.dataset.end);
        if (Number.isNaN(this.end)) return;
        this.tick();
        this.timer = setInterval(() => this.tick(), 1000);
      }
      disconnectedCallback() {
        clearInterval(this.timer);
      }
      tick() {
        const diff = this.end - Date.now();
        if (diff <= 0) {
          clearInterval(this.timer);
          this.querySelector('[data-countdown-units]').hidden = true;
          this.querySelector('[data-countdown-live]').hidden = false;
          document.dispatchEvent(new CustomEvent('drop:live'));
          return;
        }
        const parts = {
          days: Math.floor(diff / 86400000),
          hours: Math.floor(diff / 3600000) % 24,
          minutes: Math.floor(diff / 60000) % 60,
          seconds: Math.floor(diff / 1000) % 60,
        };
        Object.entries(parts).forEach(([key, value]) => {
          const el = this.querySelector(`[data-unit="${key}"]`);
          if (el) el.textContent = String(value).padStart(2, '0');
        });
      }
    }
  );
}
(() => {
  const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -10% 0px' }
  );

  const observeReveals = (scope = document) => {
    scope.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => revealObserver.observe(el));
  };

  const cart = {
    drawer() {
      return document.getElementById('CartDrawer');
    },
    open() {
      const drawer = this.drawer();
      if (drawer && !drawer.open) drawer.showModal();
    },
    close() {
      const drawer = this.drawer();
      if (drawer && drawer.open) drawer.close();
    },
    async refresh() {
      const response = await fetch(`${root}?sections=cart-drawer`);
      const data = await response.json();
      const html = new DOMParser().parseFromString(data['cart-drawer'], 'text/html');
      const fresh = html.querySelector('[data-cart-drawer-inner]');
      const current = document.querySelector('[data-cart-drawer-inner]');
      if (fresh && current) current.replaceWith(fresh);
      const count = fresh ? fresh.dataset.cartCount : '0';
      document.querySelectorAll('[data-cart-count]').forEach((el) => {
        el.textContent = count;
        el.hidden = count === '0';
      });
    },
    async add(form) {
      const button = form.querySelector('[type="submit"]');
      const error = form.querySelector('[data-form-error]');
      if (button) button.setAttribute('aria-busy', 'true');
      if (error) error.textContent = '';
      try {
        const response = await fetch(`${root}cart/add.js`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.description || data.message);
        await this.refresh();
        this.open();
      } catch (e) {
        if (error) error.textContent = e.message;
      } finally {
        if (button) button.removeAttribute('aria-busy');
      }
    },
    async change(line, quantity) {
      const inner = document.querySelector('[data-cart-drawer-inner]');
      if (inner) inner.setAttribute('aria-busy', 'true');
      await fetch(`${root}cart/change.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ line, quantity }),
      });
      await this.refresh();
    },
  };

  window.ROS = { cart, observeReveals };

  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-cart-open]');
    if (opener && cart.drawer()) {
      event.preventDefault();
      cart.open();
      return;
    }
    if (event.target.closest('[data-cart-close]')) {
      cart.close();
      return;
    }
    const qty = event.target.closest('[data-cart-qty]');
    if (qty) {
      cart.change(Number(qty.dataset.line), Number(qty.dataset.cartQty));
      return;
    }
    const drawer = cart.drawer();
    if (drawer && event.target === drawer) cart.close();
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-ajax-cart]');
    if (!form) return;
    event.preventDefault();
    cart.add(form);
  });

  const init = () => observeReveals();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('shopify:section:load', (event) => observeReveals(event.target));
})();
