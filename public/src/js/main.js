import { router }        from './helpers/router.js';
import { initShell, currentUser } from './shell.js';
import { renderHome }    from './views/home.js';
import { renderCatalog } from './views/catalog.js';
import { renderVolumeDetail } from './views/volumeDetail.js?v=3';
import { renderPublishers } from './views/publishers.js';
import { renderAuth } from './views/auth.js';
import { renderBookmarks } from './views/bookmarks.js';
import { renderFavorites } from './views/favorites.js';
import { renderUserLists } from './views/userLists.js';
import { renderCollections } from './views/collections.js';
import { renderSettings } from './views/settings.js';
import { renderCollectionDetail } from './views/collectionDetail.js';

async function start() {
  const main = await initShell();

  router
    .on('/',              () => renderHome(main))
    .on('/catalog',       (_path, _params, query) => renderCatalog(main, query))
    .on('/volumes/:id',   (_path, params, _query) => renderVolumeDetail(main, params))
    .on('/collections/:id', (_path, params) => renderCollectionDetail(main, params))
    .on('/publishers',    (_path, _params, query) => renderPublishers(main, query))
    .on('/auth',          () => renderAuth(main))
    .on('/bookmarks',     () => renderBookmarks(main))
    .on('/settings',      () => {
        if (!currentUser) {
            router.navigate('/auth');
            return;
        }
        renderSettings(main, currentUser);
    })
    .on('/user/:username/lists', (_path, params, query) => renderUserLists(main, params, query))
    .on('/user/:username/collection', (_path, params) => renderCollections(main, params))
    .on('/user/:username/favorites', (_path, params) => renderFavorites(main, params))
    .notFound(            () => renderHome(main))
    .listen();
}

start();
