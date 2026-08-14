import { router }        from './helpers/router.js';
import { initShell, currentUser } from './shell.js';
import { initGlobalModalListeners } from './helpers/modalManager.js';

initGlobalModalListeners();
import { renderHome }    from './views/home.js';
import { renderEdits }   from './views/edits.js';
import { renderUsers }   from './views/users.js';
import { renderUserProfile } from './views/userProfile.js';
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
import { renderEssences } from './views/essences.js';
import { renderEssenceDetail } from './views/essenceDetail.js';
import { renderPersonnel } from './views/personnel.js';
import { renderPersonnelDetail } from './views/personnelDetail.js';
import { renderMagazineDetail } from './views/magazineDetail.js';
import { renderMagazineIssueDetail } from './views/magazineIssueDetail.js';
import { renderMagazineAllItems } from './views/magazineAllItems.js';
import { renderMangaChapterDetail } from './views/mangaChapterDetail.js';
import { renderMangaMagazinesCatalog } from './views/mangaMagazinesCatalog.js';
import { renderMangaChaptersCatalog } from './views/mangaChaptersCatalog.js';
import { renderNotifications } from './views/NotificationsView.js';
import { renderMangaCalendar } from './views/mangaCalendar.js';
import { renderReleaseCalendar } from './views/releaseCalendar.js';

async function start() {
  const main = await initShell();

  router
    .on('/',              () => renderHome(main))
    .on('/catalog',       (_path, _params, query) => renderCatalog(main, query))
    .on('/calendar',      (_path, _params, query) => renderReleaseCalendar(main, query))
    .on('/calendar/releases', (_path, _params, query) => renderReleaseCalendar(main, query))
    .on('/calendar/comics', (_path, _params, query) => renderReleaseCalendar(main, query))
    .on('/calendar/manga', (_path, _params, query) => renderMangaCalendar(main, query))
    .on('/manga-magazines', (_path, _params, query) => renderMangaMagazinesCatalog(main, query))
    .on('/manga-chapters', (_path, _params, query) => renderMangaChaptersCatalog(main, query))
    .on('/notifications', () => renderNotifications(main))
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
    .on('/characters/:id/persona/:personaIdx', (_path, params, query) => renderCharacterDetail(main, params, query))
    .on('/characters/:id', (_path, params, query) => renderCharacterDetail(main, params, query))
    .on('/essences',      (_path, _params, query) => renderEssences(main, query))
    .on('/essences/:slug', (_path, params) => renderEssenceDetail(main, params))
    .on('/personnel',     (_path, _params, query) => renderPersonnel(main, query))
    .on('/personnel/:id', (_path, params, query) => renderPersonnelDetail(main, params, query))
    .on('/persons',       (_path, _params, query) => renderPersonnel(main, query))
    .on('/persons/:id',   (_path, params, query) => renderPersonnelDetail(main, params, query))
    .on('/auth',          () => renderAuth(main))
    .on('/bookmarks',     () => renderBookmarks(main))
    .on('/settings',      () => {
        if (!currentUser) {
            router.navigate('/auth');
            return;
        }
        renderSettings(main, currentUser);
    })
    .on('/user/:username', (_path, params, query) => renderUserProfile(main, params, query))
    .on('/user/:username/lists', (_path, params) => renderUserProfile(main, params, { tab: 'readlists' }))
    .on('/user/:username/collection', (_path, params) => renderUserProfile(main, params, { tab: 'collections' }))
    .on('/user/:username/favorites', (_path, params) => renderUserProfile(main, params, { tab: 'favorites' }))
    .on('/edits',         (_path, _params, query) => renderEdits(main, query))
    .on('/edits/:id',     (_path, params) => renderEditDetail(main, params))
    .on('/users',         () => renderUsers(main))
    .notFound(            () => renderHome(main))
    .listen();
}

start();
