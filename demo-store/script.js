let chosenSize = '';
let cartCount = 0;
let previousFocus = null;

function selectSize(size, element) {
  chosenSize = size;
  document.querySelectorAll('[data-size]').forEach(swatch => {
    const selected = swatch === element;
    swatch.classList.toggle('selected', selected);
    if (swatch.hasAttribute('aria-pressed')) swatch.setAttribute('aria-pressed', String(selected));
  });
  document.getElementById('selected-size').textContent = size;
  document.getElementById('cart-status').textContent = '';
}

function addToCart() {
  const status = document.getElementById('cart-status');
  if (!chosenSize) {
    status.textContent = 'Please select a size first.';
    return;
  }
  cartCount += 1;
  document.querySelector('[data-cart-count]').textContent = String(cartCount);
  document.getElementById('cart-size').textContent = chosenSize;
  document.getElementById('cart-subtotal').textContent = `$${(38 * cartCount).toFixed(2)}`;
  status.textContent = `Added The Essential Tee, size ${chosenSize}, to your bag. ${cartCount} item${cartCount === 1 ? '' : 's'}.`;
  openCart();
}

function openCart() {
  const drawer = document.getElementById('cart-drawer');
  previousFocus = document.activeElement;
  drawer.hidden = false;
  document.getElementById('drawer-backdrop').hidden = false;
  document.body.style.overflow = 'hidden';
  drawer.querySelector('button').focus();
}

function closeCart() {
  document.getElementById('cart-drawer').hidden = true;
  document.getElementById('drawer-backdrop').hidden = true;
  document.body.style.overflow = '';
  if (previousFocus instanceof HTMLElement) previousFocus.focus();
}

document.getElementById('cart-drawer').addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const focusable = [...event.currentTarget.querySelectorAll('button, a[href], input, [tabindex="0"]')];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
