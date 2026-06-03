/**
 * Pagination Component (matches Manga Pulse pattern).
 */
export function createPaginator({ pageSize = 20 } = {}) {
  let currentPage = 1;
  let nextCursor = null;

  function clampPage(page, totalPages = Number.POSITIVE_INFINITY) {
    const parsed = Number.parseInt(page, 10);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(Math.max(parsed, 1), totalPages);
  }

  function reset() {
    currentPage = 1;
    nextCursor = null;
  }

  function setPage(page) {
    currentPage = clampPage(page);
  }

  function setNextCursor(cursor) {
    nextCursor = cursor;
  }

  function render(total, onChange) {
    const totalPages  = Math.ceil(total / pageSize) || 1;
    currentPage       = clampPage(currentPage, totalPages);
    const hasPrev     = currentPage > 1;
    const hasNext     = !!nextCursor || currentPage < totalPages;
    const from        = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const to          = Math.min(currentPage * pageSize, total);

    const nav = document.createElement('nav');
    nav.className = 'pagination';
    nav.setAttribute('aria-label', 'Сторінки');

    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn pagination-prev';
    prevBtn.disabled  = !hasPrev;
    prevBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>`;
    prevBtn.addEventListener('click', () => {
      if (!hasPrev) return;
      currentPage--;
      // For simplicity in this SPA, we reset cursor on prev and let API handle it via offset
      // or we could store a stack of cursors. For now, we only use cursor for "Next"
      nextCursor = null; 
      onChange();
    });

    const pageInput = document.createElement('input');
    pageInput.className = 'pagination-page-input';
    pageInput.type = 'number';
    pageInput.min = '1';
    pageInput.max = String(totalPages);
    pageInput.step = '1';
    pageInput.value = String(currentPage);
    pageInput.title = 'Вкажіть номер сторінки';
    pageInput.setAttribute('aria-label', 'Номер сторінки');

    const goToInputPage = () => {
      const nextPage = clampPage(pageInput.value, totalPages);
      pageInput.value = String(nextPage);
      if (nextPage === currentPage) return;
      currentPage = nextPage;
      nextCursor = null;
      onChange();
    };

    pageInput.addEventListener('focus', () => {
      pageInput.select();
    });

    pageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        goToInputPage();
      }

      if (event.key === 'Escape') {
        pageInput.value = String(currentPage);
        pageInput.blur();
      }
    });

    pageInput.addEventListener('blur', goToInputPage);

    const info = document.createElement('div');
    info.className = 'pagination-info';
    info.innerHTML = `
      <strong>${from}–${to}</strong>
      <span class="pagination-sep">/</span>
      ${total.toLocaleString('uk-UA')}
      &nbsp;·&nbsp;
      <span>стор.</span>
      <span class="pagination-page-slot"></span>
      <span>з <strong>${totalPages}</strong></span>`;
    info.querySelector('.pagination-page-slot').appendChild(pageInput);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn pagination-next';
    nextBtn.disabled  = !hasNext;
    nextBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>`;
    nextBtn.addEventListener('click', () => {
      if (!hasNext) return;
      currentPage++;
      // Pass the current cursor to the onChange callback
      onChange(nextCursor);
    });

    nav.append(prevBtn, info, nextBtn);
    return nav;
  }

  return {
    reset,
    setPage,
    setNextCursor,
    render,
    getPageSize: () => pageSize,
    getPage:     () => currentPage,
    getCursor:   () => nextCursor,
  };
}
