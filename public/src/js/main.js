import { router }        from './helpers/router.js';
import { initShell, currentUser } from './shell.js';
import { renderHome }    from './views/home.js';
import { renderEdits }   from './views/edits.js';
import { renderEditDetail } from './views/editDetail.js';
import { renderCatalog } from './views/catalog.js';
import { renderVolumeDetail } from './views/volumeDetail.js?v=3';
import { renderVolumeCharacters } from './views/volumeCharacters.js';
import { renderPublishers } from './views/publishers.js';
import { renderPublisherDetail } from './views/publisherDetail.js';
import { renderAuth } from './views/auth.js';
import { renderBookmarks } from './views/bookmarks.js';
import { renderFavorites } from './views/favorites.js';
import { renderUserLists } from './views/userLists.js';
import { renderCollections } from './views/collections.js';
import { renderSettings } from './views/settings.js';
import { renderCollectionDetail } from './views/collectionDetail.js';
import { renderIssueDetail } from './views/issueDetail.js';
import { renderEventDetail } from './views/eventDetail.js';
import { renderEvents } from './views/events.js';
import { renderCharacters } from './views/characters.js';
import { renderCharacterDetail } from './views/characterDetail.js';
import { renderPersonnel } from './views/personnel.js';
import { renderPersonnelDetail } from './views/personnelDetail.js';
import { renderMagazineDetail } from './views/magazineDetail.js';
import { renderMagazineIssueDetail } from './views/magazineIssueDetail.js';
import { renderMagazineAllItems } from './views/magazineAllItems.js';
import { renderMangaChapterDetail } from './views/mangaChapterDetail.js';
import { renderMangaMagazinesCatalog } from './views/mangaMagazinesCatalog.js';
import { renderMangaChaptersCatalog } from './views/mangaChaptersCatalog.js';

async function start() {
  const main = await initShell();

  router
    .on('/',              () => renderHome(main))
    .on('/catalog',       (_path, _params, query) => renderCatalog(main, query))
    .on('/manga-magazines', (_path, _params, query) => renderMangaMagazinesCatalog(main, query))
    .on('/manga-chapters', (_path, _params, query) => renderMangaChaptersCatalog(main, query))
    .on('/volumes/:id',   (_path, params, query) => renderVolumeDetail(main, params, query))
    .on('/volumes/:id/characters', (_path, params) => {
        router.navigate(`/volumes/${params.id}?tab=characters`);
    })
    .on('/magazines/:id', (_path, params) => renderMagazineDetail(main, params))
    .on('/magazines/:id/all', (_path, params) => renderMagazineAllItems(main, params))
    .on('/magazines/issues/:id', (_path, params) => renderMagazineIssueDetail(main, params))
    .on('/collections/:id', (_path, params) => renderCollectionDetail(main, params))
    .on('/issues/:id',    (_path, params) => renderIssueDetail(main, params))
    .on('/manga-chapters/:id', (_path, params) => renderMangaChapterDetail(main, params))
    .on('/events',        (_path, _params, query) => renderEvents(main, query))
    .on('/events/:id',    (_path, params) => renderEventDetail(main, params))
    .on('/publishers',    (_path, _params, query) => renderPublishers(main, query))
    .on('/publishers/:id', (_path, params) => renderPublisherDetail(main, params))
    .on('/characters',    (_path, _params, query) => renderCharacters(main, query))
    .on('/characters/:id', (_path, params) => renderCharacterDetail(main, params))
    .on('/personnel',     (_path, _params, query) => renderPersonnel(main, query))
    .on('/personnel/:id', (_path, params) => renderPersonnelDetail(main, params))
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
    .on('/edits',         () => {
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'moderator')) {
            router.navigate('/');
            return;
        }
        renderEdits(main);
    })
    .on('/edits/:id',     (_path, params) => {
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'moderator')) {
            router.navigate('/');
            return;
        }
        renderEditDetail(main, params);
    })
    .notFound(            () => renderHome(main))
    .listen();
}

start();
