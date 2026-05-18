# Java Middle — подготовка к собеседованию

Статический сайт: **91 вопрос теории** + **32 задачи практики** + **план 14 дней**.

## GitHub Pages

Сайт лежит в папке **`docs/`** (не в корне).

**Settings → Pages → Build and deployment:**

- **Source:** GitHub Actions (workflow `Deploy Pages`)

  *или* Deploy from branch → `main` → folder **`/docs`** (в `docs/` есть файл `.nojekyll`, Jekyll не трогает JSON/JS).

URL: `https://thruwol.github.io/zatryil/`

## Локально

```bash
cd docs
python -m http.server 8080
```

Откройте http://localhost:8080

## Обновление контента

Если правите JSON вручную — коммитьте `docs/data/*.json`.  
Если есть исходный markdown в родительском проекте — пересоберите и скопируйте в `docs/data/`.
