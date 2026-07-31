/**
 * Lightweight hash-based SPA router.
 * Підтримує як точні маршрути ('/catalog'), так і параметричні ('/volumes/:id').
 */
export class Router {
  #routes          = new Map();
  #fallback        = null;
  #currentPath     = null;
  #changeListeners = [];

  /** Register a route handler. Chainable. */
  on(pattern, handler) {
    this.#routes.set(pattern, handler);
    return this;
  }

  /** Fallback when no route matches. */
  notFound(handler) {
    this.#fallback = handler;
    return this;
  }

  get currentPath() { return this.#currentPath; }

  /** Resolve current hash and call the matching handler. */
  resolve() {
    const rawHash = location.hash.replace(/^#\/?/, '');
    const [rawPath, search] = rawHash.split('?');
    const path = '/' + rawPath;
    this.#currentPath = path;

    const query = {};
    if (location.search) {
      const searchParams = new URLSearchParams(location.search);
      for (const [key, value] of searchParams.entries()) {
        query[key] = value;
      }
    }
    if (search) {
      const searchParams = new URLSearchParams(search);
      for (const [key, value] of searchParams.entries()) {
        query[key] = value;
      }
    }

    let handler = this.#routes.get(path);
    let params  = {};

    if (!handler) {
      for (const [pattern, h] of this.#routes) {
        const matched = matchPath(pattern, path);
        if (matched !== null) {
          handler = h;
          params  = matched;
          break;
        }
      }
    }

    (handler ?? this.#fallback)?.(path, params, query);
    this.#changeListeners.forEach(fn => fn(path, query));
  }

  /** Programmatic navigation. */
  navigate(path) {
    location.hash = path;
  }

  /** Subscribe to route changes. */
  onChange(fn) {
    this.#changeListeners.push(fn);
    return this;
  }

  /** Start listening to hashchange + resolve immediately. Chainable. */
  listen() {
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
    return this;
  }
}

/**
 * Matches a URL pattern with :param segments against an actual path.
 */
function matchPath(pattern, path) {
  const pp = pattern.split('/');
  const sp = path.split('/');
  if (pp.length !== sp.length) return null;

  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) {
      params[pp[i].slice(1)] = decodeURIComponent(sp[i]);
    } else if (pp[i] !== sp[i]) {
      return null;
    }
  }
  return params;
}

export const router = new Router();
