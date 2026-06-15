import express, {type Request, type Response} from 'express';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {searchArtist} from '../lib/musicbrainz.js';
import {refresh, refreshArtist} from '../lib/refresh.js';
import {sendTestEmail} from '../lib/notify.js';
import {Artist} from '../lib/Artist.js';
import {Release} from '../lib/Release.js';
import {Settings, type SettingsPatch} from '../lib/Settings.js';

// Locate the built web assets. When bundled by tsup the file lives at
// dist/cli/index.js, so dist/web is two levels up; during `tsx` dev runs the
// file is src/server/index.ts and dist/web may not exist yet (the dev server is
// served by Vite instead). We key on index.html so a stale/empty dist/web isn't
// mistaken for a real build.
function webDir(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '..', 'web'), // dist/cli/index.js -> dist/web
    join(here, '..', '..', 'dist', 'web'), // src/server/index.ts -> dist/web
  ];
  return candidates.find(c => existsSync(join(c, 'index.html'))) ?? null;
}

function asyncRoute(
  fn: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response) => void {
  return (req, res) => {
    fn(req, res).catch(err => {
      console.error(err);
      res
        .status(500)
        .json({error: err instanceof Error ? err.message : String(err)});
    });
  };
}

export function createApp() {
  const app = express();
  app.use(express.json());

  const api = express.Router();

  api.get('/artists', (_req, res) => {
    res.json(Artist.list());
  });

  api.get(
    '/artists/search',
    asyncRoute(async (req, res) => {
      const q = String(req.query.q ?? '').trim();
      if (!q) {
        res.json([]);
        return;
      }
      res.json(await searchArtist(q));
    }),
  );

  api.post(
    '/artists',
    asyncRoute(async (req, res) => {
      const {mbid, name, sortName, disambiguation, type, country} =
        req.body ?? {};
      if (!mbid || !name) {
        res.status(400).json({error: 'mbid and name are required'});
        return;
      }
      const added = Artist.add({
        mbid,
        name,
        sortName,
        disambiguation,
        type,
        country,
      });
      const artist = added ? Artist.get(mbid) : undefined;
      if (artist) {
        await refreshArtist(artist, {notify: false});
      }
      res.json({added});
    }),
  );

  api.delete('/artists/:mbid', (req, res) => {
    const artist = Artist.get(req.params.mbid);
    if (!artist) {
      res.status(404).json({error: 'artist not tracked'});
      return;
    }
    artist.remove();
    res.json({removed: artist});
  });

  api.get('/releases', (req, res) => {
    const onlyNew = req.query.new === '1' || req.query.new === 'true';
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(Release.list({onlyNew, limit}));
  });

  api.post('/releases/:mbid/dismiss', (req, res) => {
    const dismissed = Release.dismiss(req.params.mbid);
    if (!dismissed) {
      res.status(404).json({error: 'release not found'});
      return;
    }
    res.json({dismissed});
  });

  api.post(
    '/refresh',
    asyncRoute(async (_req, res) => {
      const summary = await refresh();
      res.json(summary);
    }),
  );

  api.get('/settings', (_req, res) => {
    res.json(Settings.load());
  });

  api.put('/settings', (req, res) => {
    const patch = req.body as SettingsPatch;
    res.json(Settings.save(patch));
  });

  api.post(
    '/settings/test-email',
    asyncRoute(async (req, res) => {
      // Allow testing with the posted settings (saved first), or current ones.
      const patch = req.body as SettingsPatch | undefined;
      const settings =
        patch && Object.keys(patch).length
          ? Settings.save(patch)
          : Settings.load();
      await sendTestEmail(settings);
      res.json({ok: true});
    }),
  );

  app.use('/api', api);

  // Serve the built SPA (production). In dev, Vite serves the frontend and
  // proxies /api here, so a missing web dir is fine.
  const dir = webDir();
  if (dir) {
    app.use(express.static(dir));
    app.get('*', (_req, res) => {
      res.sendFile(join(dir, 'index.html'));
    });
  } else {
    app.get('*', (_req, res) => {
      res
        .status(503)
        .type('text')
        .send('Web assets are not built. Run `npm run build` and try again.');
    });
  }

  return app;
}

// Start the web server, resolving with the port it bound to. Rejects on a
// listen error (e.g. EADDRINUSE) so callers can retry on a different port.
export function startServer(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createApp().listen(port);
    server.once('listening', () => {
      server.removeListener('error', reject);
      resolve(port);
    });
    server.once('error', reject);
  });
}
