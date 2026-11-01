# CMSik — CMS dla strony biura podróży (home + landing pages)

System CMS dla strony biura podróży oparty na szablonie **TraveLand** (UIdeck,
MIT, Bootstrap 4.5.2) po stronie klienta oraz **Tabler** (MIT, Bootstrap 5) w
panelu administracyjnym. Logika systemu (backend, baza danych,
uwierzytelnianie, zarządzanie treścią) napisana samodzielnie — bez gotowców CMS.

Strona kliencka składa się z **home page** (overview z krótkimi sekcjami jak w
oryginalnym szablonie TraveLand) oraz **landing pages** (rozbudowane podstrony
About, Services, Blog, Contact, pełny wpis bloga oraz proste strony statyczne).

## Stack technologiczny

- **Node.js** + **Express** 4
- **SQLite** przez `better-sqlite3` 13.x (synchroniczny, szybki, brak konfiguracji; wymaga Node 20+)
- **EJS** — szablony server-side
- **Bootstrap 4.5.2** (TraveLand) + **Bootstrap 5 / Tabler** (admin, przez CDN)
- **multer** 2.x — upload plików (zdjęcia wpisów, logo)
- **bcryptjs** — haslowanie haseł
- **express-session** + **connect-flash** — sesje i komunikaty
- jQuery (z szablonu TraveLand) — smooth scroll, liczniki, WOW.js

> Uwaga dot. bezpieczeństwa: `npm install` kończy się bez deprecation warnings i bez vulnerabilities
> (`multer` 2.x łata znane CVE z gałęzi 1.x, a `better-sqlite3` 13.x porzuca przestarzały
> `prebuild-install`). `minimatch` jest wymuszony na `^11.0.1` przez pole `overrides` w `package.json`
> (lata pośrednią DoS w łańcuchu `ejs → jake → filelist → minimatch`).

## Instalacja i uruchomienie

Wymagania: **Node.js 20+** (zalecane LTS), npm 10+.

```bash
# 1. instalacja zależności
npm install

# 2. inicjalizacja bazy danych (tworzy schemat, konto admina, dane przykładowe)
npm run init-db

# 3. start serwera
npm start          # produkcyjnie
npm run dev        # tryb watch (auto-restart po zmianie)

# Aplikacja nasłuchuje na http://localhost:3000
```

### Domyślne konto administratora

```
URL:     http://localhost:3000/admin/login
E-mail:  admin@cmsik.local
Hasło:   admin123
```

Zmień hasło po pierwszym logowaniu w panelu **Konto → Zmiana hasła**.

### Reset bazy danych

```bash
npm run init-db -- --reset     # usuwa wszystkie tabele i seeduje od nowa
```

## Struktura projektu

```
cmsik/
├── server.js                 # Aplikacja Express (wejście)
├── package.json
├── src/
│   ├── config/
│   │   ├── app.js            # Konfiguracja (port, sekret sesji, katalog upload)
│   │   └── database.js       # Połączenie SQLite + auto-schema + migracje
│   ├── db/
│   │   └── schema.sql        # Schemat bazy danych
│   ├── middleware/
│   │   ├── auth.js           # requireAuth / redirectIfAuth
│   │   └── upload.js         # multer (logo, zdjęcia wpisów)
│   └── utils/
│       └── helpers.js        # settings cache, tokeny resetu, formatowanie dat
├── scripts/
│   ├── init-db.js            # npm run init-db
│   └── seed.js               # Tworzy admina + przykładowe dane
├── views/
│   ├── client/
│   │   ├── index.ejs         # Home page (TraveLand, renderowana z bazy)
│   │   ├── about.ejs         # Landing page About (/about)
│   │   ├── services.ejs      # Landing page Services (/services)
│   │   ├── blog.ejs          # Lista wpisów z paginacją (/blog)
│   │   ├── post.ejs          # Pełny wpis (/post/:id)
│   │   ├── contact.ejs       # Landing page Contact (/contact)
│   │   ├── static-page.ejs   # Strona statyczna (/p/:slug)
│   │   └── partials/
│   │       ├── _header.ejs   # Wspólny nagłówek + hero dla LP
│   │       └── _footer.ejs   # Wspólna stopka
│   └── admin/
│       ├── login.ejs         # Ekran logowania (standalone)
│       ├── forgot.ejs        # Reset hasła — żądanie
│       ├── reset.ejs         # Reset hasła — nowe hasło
│       ├── error.ejs         # Strony błędów
│       ├── dashboard.ejs     # Pulpit z podsumowaniem
│       ├── sections.ejs      # Edytor treści sekcji strony głównej
│       ├── pages.ejs         # Strony (overview landing pages)
│       ├── page-about.ejs    # Edytor About LP + CRUD zespołu + CRUD wartości
│       ├── page-services.ejs # Edytor Services LP + CRUD usług + CRUD kroków
│       ├── page-blog.ejs     # Edytor Blog LP (hero)
│       ├── page-contact.ejs  # Edytor Contact LP + dane kontaktowe + mapa
│       ├── static-pages.ejs  # Lista stron statycznych
│       ├── static-page-edit.ejs # Edytor strony statycznej
│       ├── posts.ejs         # Lista wpisów bloga
│       ├── post-edit.ejs     # Edytor wpisu
│       ├── menu.ejs          # Zarządzanie menu (drag & drop)
│       ├── messages.ejs      # Wiadomości z formularza kontaktowego
│       ├── newsletter.ejs    # Subskrybenci newslettera
│       ├── settings.ejs      # Ustawienia serwisu
│       ├── account.ejs       # Konto administratora
│       └── partials/
│           ├── _top.ejs      # Nagłówek + sidebar + flash
│           └── _bottom.ejs   # Zamknięcie layoutu + skrypty
├── public/
│   ├── traveland/            # Szablon TraveLand (assets + cmsik.css)
│   ├── admin/
│   │   └── admin.css         # Dopełnienia do Tablera
│   └── uploads/              # Uploadowane pliki (multer)
└── data/                     # Baza SQLite (cmsik.sqlite)
```

## Schemat bazy danych

Tabela           | Pola
---              | ---
`users`          | `id, email (UNIQUE), password_hash, name, created_at`
`password_resets`| `id, user_id, token_hash, expires_at, used_at, created_at`
`pages`          | `id, title, slug (UNIQUE), status, is_home, created_at, updated_at, published_at`
`components`     | `id, section_id, block_type, key, label, text, icon, image_url, link, position, is_visible, created_at, updated_at`
`posts`          | `id, title, author, published_at, image, body, status, created_at, updated_at`
`messages`       | `id, name, phone, email, trip, body, is_read, created_at`
`subscribers`    | `id, email (UNIQUE), created_at`
`menu_items`     | `id, label, target_section, position, is_visible, created_at`
`services`       | `id, icon, title, description, image_url, position, is_visible, created_at, updated_at`
`process_steps`  | `id, number, title, description, position, created_at`
`team_members`   | `id, name, role, bio, image_url, position, is_visible, created_at`
`team_values`    | `id, icon, title, description, position, created_at`
`contact_info`   | `id (=1), address, phone, email, hours_week, hours_weekend, map_embed_url`
`static_pages`   | `id, title, slug (UNIQUE), body, is_visible, created_at, updated_at`
`settings`       | `key (PK), value`

Rozszerzenia schematu względem oryginalnej specyfikacji:
- `components` — dodano kolumny `block_type`, `key`, `image_url`, `link`, `updated_at` (pozwala na przechowywanie całej treści sekcji Home oraz komponentów landing pages w jednej elastycznej tabeli).
- `services`, `process_steps`, `team_members`, `team_values`, `contact_info`, `static_pages` — nowe tabele dla treści landing pages.
- `subscribers`, `menu_items`, `settings` — dodane tabele wynikające z wymagań funkcjonalnych (newsletter, dynamiczne menu, ustawienia serwisu).

## Funkcjonalności

### Część kliencka

**Home page (`/`)** — wizualnie jak oryginalny szablon TraveLand:
- Hero z wyróżnionym słowem, podtytułem, przyciskiem i zdjęciem tła.
- About Us (eyebrow, nagłówek, 2 akapity, przycisk, zdjęcie) + 4 liczniki.
- Services (3 kafelki: ikona, tytuł, opis).
- Recent Blog Post (3 najnowsze opublikowane wpisy, najnowszy wyróżniony).
- Get in Touch (formularz kontaktowy).
- Stopka z newsletterem i linkami social.
- Menu w nagłówku i stopce prowadzi do landing pages (`/about`, `/services`, `/blog`, `/contact`); zakładka Home przewija do sekcji home na stronie głównej.

**Landing pages:**

| URL | Zawartość |
|---|---|
| `/about` | Hero + sekcja „Kim jesteśmy" (tekst + zdjęcie) + 4 liczniki (współdzielone z home) + sekcja „Nasze wartości" (3 kafelki z ikonami) + sekcja „Zespół" (3-4 osoby: imię, rola, bio, zdjęcie) + CTA |
| `/services` | Hero + intro + pełna lista usług (ikona, tytuł, długi opis, opcjonalne zdjęcie — CRUD) + sekcja „Proces współpracy" (3-4 kroki z numerem, tytułem, opisem — CRUD) + CTA |
| `/blog` | Hero + lista wszystkich opublikowanych wpisów (karty z miniaturką, tytułem, autorem, datą, zajawką) + paginacja 9/strona + sidebar (ostatnie 5 wpisów + formularz newslettera) |
| `/post/:id` | Banner z tytułem wpisu, autor i data, zdjęcie, pełna treść (akapity), link powrotu do `/blog`, sidebar z innymi wpisami i newsletterem |
| `/contact` | Hero + 4 kafelki danych kontaktowych (adres, telefon, e-mail, godziny) + rozbudowany formularz kontaktowy + mapa (OpenStreetMap iframe) |
| `/p/:slug` | Prosta strona statyczna (np. Privacy Policy): baner z tytułem, treść, link powrotu |

- Menu nawigacyjne budowane dynamicznie z tabeli `menu_items` (kolejność, widoczność, strona docelowa ustawiane w panelu).
- Kliknięcie zakładki = przekierowanie do URL-a landing page (`/about`, `/services`, `/blog`, `/contact`). Tylko zakładka Home scrolluje po stronie głównej.
- Formularze kontaktowe (na home i na `/contact`) — te same pola, walidacja server-side, wiadomości trafiają do panelu.
- Newsletter działa na home (stopka), na `/blog` (sidebar) i na `/post/:id` (sidebar) — przekierowuje z powrotem na tę samą stronę.
- Responsywność: komputer, tablet, telefon (Bootstrap 4 grid + media queries TraveLand).
- Domyślne kolory TraveLand (#EEC41E) i Tablera (default primary). Kolor przewodni opcjonalnie zmieniany w ustawieniach (override CSS w `<head>` — działa globalnie).

### Część administracyjna (`/admin`)

**Uwierzytelnianie**
- Logowanie (e-mail + hasło, bcrypt).
- Reset hasła: żądanie → jednorazowy token (SHA-256 hash, 1h TTL) → formularz nowego hasła.
- Wylogowanie.
- Zmiana hasła w panelu Konto.

**Pulpit**
- Statystyki: liczba wpisów, szkiców, nowych wiadomości, subskrybentów.
- Ostatnio edytowane wpisy (5 ostatnich).
- Ostatnie wiadomości (5 ostatnich).

**Treść sekcji** (`/admin/sections`)
- Edycja wszystkich sekcji strony głównej w jednym formularzu:
  - Home (etykieta, wyróżnione słowo, podtytuł, przycisk, link, zdjęcie tła)
  - About Us (eyebrow, nagłówek z HTML, 2 akapity, przycisk, link, zdjęcie)
  - 4 liczniki (wartość + etykieta)
  - Nagłówek Services (eyebrow, tytuł)
  - 3 kafelki Services (ikona LineIcons, tytuł, opis)
  - Nagłówek Blog
  - Nagłówek Contact (eyebrow, tytuł, tekst pomocniczy)
  - Tekst stopki

**Wpisy blogowe** (`/admin/posts`)
- Lista wpisów z miniaturką zdjęcia, statusem (szkic/opublikowany) i datą.
- Dodawanie / edycja / usuwanie.
- Upload zdjęcia (multer, max 5 MB, walidacja typu MIME).
- Możliwość usunięcia zdjęcia bez usuwania wpisu.
- Autor, data publikacji, status (szkic / opublikowany).
- Na stronie głównej pokazują się **3 najnowsze opublikowane** wpisy (najnowszy wyróżniony).

**Menu nawigacji** (`/admin/menu`) — **najważniejsza funkcjonalność**
- Dodawanie / edycja / usuwanie zakładek.
- Zmiana nazwy i strony docelowej inline (formularz w linii).
- **Przeciągnij i upuść** (HTML5 DnD + `fetch` do `/admin/api/menu/reorder`) — automatyczny zapis kolejności.
- Ukrywanie / pokazywanie zakładek bez usuwania (przełącznik `is_visible`).
- 5 stron docelowych do wyboru: Home (`/`), About (`/about`), Services (`/services`), Blog (`/blog`), Contact (`/contact`).

**Strony — landing pages** (`/admin/pages`)
- Overview z kartami prowadzącymi do edytorów poszczególnych stron.
- **About LP** (`/admin/pages/about`): edycja hero (tytuł, podtytuł), sekcji „Kim jesteśmy" (nagłówek, długi tekst, zdjęcie). Liczniki są edytowane w „Treść sekcji" (współdzielone z home). Dodatkowo CRUD wartości (3 kafelki) i CRUD zespołu (imię, rola, bio, zdjęcie, widoczność).
- **Services LP** (`/admin/pages/services`): edycja hero (tytuł, podtytuł), intro, nagłówka sekcji „Proces". Dodatkowo CRUD usług (ikona, tytuł, długi opis, opcjonalne zdjęcie, widoczność) i CRUD kroków procesu (numer auto, tytuł, opis).
- **Blog LP** (`/admin/pages/blog`): edycja hero (tytuł, podtytuł). Lista wpisów zarządzana w „Wpisy blogowe".
- **Contact LP** (`/admin/pages/contact`): edycja hero (tytuł, podtytuł) oraz danych kontaktowych (adres, telefon, e-mail, godziny pon–pt i sob, URL osadzenia mapy OSM).
- **Strony statyczne** (`/admin/static-pages`): lista + CRUD (tytuł, slug, treść, widoczność). Domyślnie zalinkowana w stopce do Privacy Policy (`/p/privacy-policy`).

**Wiadomości** (`/admin/messages`)
- Lista wiadomości z wyróżnieniem nieprzeczytanych.
- Podgląd szczegółów w prawym panelu (bootstrap tabs).
- Oznaczanie jako przeczytane.
- Odpowiedź przyciskiem otwierającym program pocztowy (`mailto:` z gotowym tematem i cytatem wiadomości).
- Usuwanie.

**Newsletter** (`/admin/newsletter`)
- Lista subskrybentów (e-mail + data zapisu).
- Eksport CSV (po stronie przeglądarki).
- Usuwanie adresów.
- System tylko zbiera adresy — wysyłkę realizujesz we własnym narzędziu (poza zakresem).

**Ustawienia** (`/admin/settings`)
- Nazwa serwisu, tagline.
- Logo (upload pliku).
- Tekst stopki, copyright (zachowana informacja o autorach szablonu UIdeck).
- Linki social media (Facebook, Twitter, Instagram, YouTube).
- Kolor przewodni (color picker, podgląd na żywo).
- Wpływa na: kolor przycisków, linków, wyróżnień, aktywnych zakładek w panelu.

**Konto** (`/admin/account`)
- Podgląd danych konta (e-mail, nazwa).
- Zmiana hasła (wymaga aktualnego hasła).

## Poza zakresem

- Rezerwacje i płatności online.
- Wysyłka newslettera (system tylko zbiera adresy — eksport CSV dostępny w panelu).
- Wysyłka odpowiedzi z poziomu panelu (używany `mailto:` z gotowym tematem i cytatem).
- Wersjonowanie treści.

## Licencje

- **TraveLand** — Design and code © UIdeck, licencja MIT, distributed by ThemeWagon.
  Informacja o autorach zachowana w stopce zgodnie z licencją.
- **Tabler** — © 2024 Tabler, licencja MIT.
- **CMSik** (logika backendu) — kod własny.

## Konfiguracja (zmienne środowiskowe)

Tworzenie pliku `.env` jest opcjonalne — wartości domyślne działają od razu:

```env
PORT=3000
HOST=0.0.0.0
SESSION_SECRET=twoj-tajny-losowy-ciąg-znaków
NODE_ENV=production
```

Aby użyć `.env`, zainstaluj `dotenv` (`npm i dotenv`) i odkomentuj odpowiednią linię
w `src/config/app.js`.

## Wdrożenie produkcyjne

1. Ustaw `SESSION_SECRET` na losowy ciąg co najmniej 32 bajtów.
2. Ustaw `NODE_ENV=production` (ciasteczka sesyjne będą `secure`).
3. Postaw za reverse proxy (nginx) z HTTPS.
4. Skonfiguruj proper SMTP i odkomentuj kod `nodemailer` w `POST /admin/forgot`
   (obecnie link resetu jest pokazywany na ekranie dla wygody demo).
5. Wykonuj backup pliku `data/cmsik.sqlite` (oraz `public/uploads/`).
