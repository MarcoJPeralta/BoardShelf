// Dev-only stand-in for worker/index.ts. Reads the BGG token from the git-ignored .dev.vars file.
import { existsSync, readFileSync } from 'node:fs';

const devVars = existsSync('.dev.vars') ? readFileSync('.dev.vars', 'utf8') : '';
const token = devVars.match(/^BGG_API_TOKEN=(.*)$/m)?.[1]?.trim();

export default {
  '/api/bgg': {
    target: 'https://boardgamegeek.com',
    secure: true,
    changeOrigin: true,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    rewrite: (path) => path.replace(/^\/api\/bgg/, '/xmlapi2'),
  },
};
