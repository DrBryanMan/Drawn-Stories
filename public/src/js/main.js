import { router }        from './helpers/router.js';
import { initShell }     from './shell.js';
import { renderHome }    from './views/home.js';
import { renderCatalog } from './views/catalog.js';
import { renderVolumeDetail } from './views/volumeDetail.js?v=3';

const main = initShell();

router
  .on('/',              () => renderHome(main))
  .on('/catalog',       (_path, _params, query) => renderCatalog(main, query))
  .on('/volumes/:id',   (_path, params, _query) => renderVolumeDetail(main, params))
  .notFound(            () => renderHome(main))
  .listen();
