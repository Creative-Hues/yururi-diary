// ドラッグでの並び替え
// 行の端の「≡」つまみをつかんだときだけ動かす(ほかの場所はふつうにスクロールできる)。
// Pointer Events を使うので、タッチ(Pixel・iPhone)とマウスの両方で動く。
// つまみにフォーカスして ↑↓ キーでも動かせる。

const EDGE = 90; // 画面の上下端からこの距離に入ったら自動でスクロール
const MAX_SCROLL_SPEED = 14;

// onSort(ids):並び替わったあとの id の順番(変わらなかったときは呼ばれない)
export function makeSortable(container, { itemSelector, handleSelector, onSort }) {
  const itemsOf = () => [...container.querySelectorAll(itemSelector)];

  container.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest(handleSelector);
    if (!handle || !container.contains(handle)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    startDrag(handle, e);
  });

  // iPhone の Safari で、つまみからページがスクロールしないように
  container.addEventListener('touchmove', (e) => {
    if (container.classList.contains('sorting')) e.preventDefault();
  }, { passive: false });

  container.addEventListener('keydown', (e) => {
    const handle = e.target.closest(handleSelector);
    if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const items = itemsOf();
    const from = items.indexOf(handle.closest(itemSelector));
    const to = from + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= items.length) return;
    const ids = items.map((it) => it.dataset.id);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onSort(ids);
  });

  function startDrag(handle, e) {
    const items = itemsOf();
    const item = handle.closest(itemSelector);
    const from = items.indexOf(item);
    const rects = items.map((it) => it.getBoundingClientRect());
    const height = rects[from].height;
    const startY = e.clientY;
    const startScroll = window.scrollY;
    let lastY = e.clientY;
    let to = from;
    let raf = 0;

    container.classList.add('sorting');
    item.classList.add('dragging');
    items.forEach((it) => { if (it !== item) it.classList.add('shifting'); });
    try { handle.setPointerCapture(e.pointerId); } catch { /* 古い端末 */ }

    const update = () => {
      const dy = lastY - startY + (window.scrollY - startScroll);
      item.style.transform = `translateY(${dy}px)`;
      const center = rects[from].top + height / 2 + dy;
      to = from;
      items.forEach((it, i) => {
        const mid = rects[i].top + rects[i].height / 2;
        let shift = 0;
        if (i < from && center < mid) { shift = height; to--; }
        if (i > from && center > mid) { shift = -height; to++; }
        if (it !== item) it.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };

    const autoScroll = () => {
      let v = 0;
      if (lastY < EDGE) v = -MAX_SCROLL_SPEED * (1 - lastY / EDGE);
      else if (lastY > window.innerHeight - EDGE) v = MAX_SCROLL_SPEED * (1 - (window.innerHeight - lastY) / EDGE);
      if (v) {
        window.scrollBy(0, v);
        update();
      }
      raf = requestAnimationFrame(autoScroll);
    };
    raf = requestAnimationFrame(autoScroll);

    const onMove = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      lastY = ev.clientY;
      update();
    };
    const onEnd = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      cancelAnimationFrame(raf);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      container.classList.remove('sorting');
      items.forEach((it) => {
        it.classList.remove('dragging', 'shifting');
        it.style.transform = '';
      });
      if (ev.type === 'pointercancel' || to === from) return;
      const ids = items.map((it) => it.dataset.id);
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      // 先に見た目を並べ替えておく(保存後に描き直す)
      const ref = items[to > from ? to + 1 : to] ?? null;
      item.parentNode.insertBefore(item, to > from ? ref : items[to]);
      onSort(ids);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  }
}
