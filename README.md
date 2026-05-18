# Java Middle — подготовка к собеседованию

Сайт в **корне** репозитория:

```
index.html
css/
js/
data/
.nojekyll
```

## GitHub Pages

**Settings → Pages → Build and deployment → Source:** **GitHub Actions** (workflow `Deploy Pages`).

Не используйте «Deploy from branch» + папку `/docs`, если папки `docs` нет.

URL: https://thruwol.github.io/zatryil/

## Локально

```bash
python -m http.server 8080
```

Откройте http://localhost:8080
