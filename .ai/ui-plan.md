# Architektura UI dla Dziennik Rutyn Eryka

## 1. Przegląd struktury UI

- Aplikacja oparta na Next.js App Router z dwoma głównymi segmentami: `/parent` (panel rodzica) oraz `/child` (interfejs dziecka), zarządzanymi przez middleware sprawdzające rolę i sesję.
- Onboarding rodzica jako trzyetapowy wizard w `/onboarding`, zapisujący stan po każdym kroku przez server actions i Supabase.
- Widoki rodzica realizowane jako Server Components z lazy-loaded Client Components dla interaktywnych fragmentów (tabele, wykresy, modale).
- Widoki dziecka projektowane mobile-first, z obsługą trybu offline (IndexedDB + kolejka synchronizacji) i gamifikowanymi elementami (animacje, paski postępu).
- Globalna telemetria poprzez Vercel Analytics; nazewnictwo zdarzeń zgodne z konwencją `role_eventScreen_action` zapisaną w `AGENTS.md`.

## 2. Lista widoków

### Ekran Startowy / Wybór Roli
- Ścieżka: `/`
- Status: ✅ Zaimplementowano (landing wyboru roli z banerem sieci, komponentami `RoleCard`, `SecurityCallout` oraz wykrywaniem aktywnej sesji)
- Główny cel: rozdzielenie użytkowników na ścieżki logowania rodzica i dziecka.
- Kluczowe informacje: CTA „Jestem rodzicem”, „Jestem Erykiem”, info o wymogu połączenia z rodziną.
- Kluczowe komponenty: karty wyboru roli, modal wylogowania, banner statusu sieci.
- UX/dostępność/bezpieczeństwo: duże CTA, wysoki kontrast, komunikat o ponownym logowaniu rodzica; sprawdzenie aktywnej sesji i redirect na odpowiedni segment.

### Logowanie Rodzica
- Ścieżka: `/auth/parent`
- Status: ✅ UI + integracja Supabase (formularz `ParentLoginForm` + server action `loginParent` z przekierowaniem do panelu)
- Główny cel: uwierzytelnienie Supabase (email+hasło, magic link).
- Kluczowe informacje: formularz logowania, link resetowania hasła.
- Kluczowe komponenty: formularz, walidacja inline, button z loaderem.
- UX/dostępność/bezpieczeństwo: obsługa klawiatury, aria-live dla błędów, wymuszony HTTPS, blokada brute-force (komunikaty po 429).

### Rejestracja Rodzica
- Ścieżka: `/auth/parent/register`
- Status: ✅ Formularz rejestracyjny z server action `signUpParent`, walidacją i komunikatem o potwierdzeniu email
- Główny cel: utworzenie konta rodzica w Supabase Auth (email + hasło).
- Kluczowe informacje: pola email/hasło, checkbox regulaminu, instrukcja potwierdzenia konta.
- Kluczowe komponenty: `ParentRegisterForm`, alerts sukces/błąd, link do logowania.
- UX/dostępność/bezpieczeństwo: walidacja hasła i zgód, komunikat o wymaganym potwierdzeniu, obsługa błędów Supabase.

### Logowanie Dziecka
- Ścieżka: `/auth/child`
- Status: ✅ UI (formularz token/PIN `ChildLoginForm`); integracja z backendem do wymiany tokenu oznaczona do wdrożenia po udostępnieniu endpointu
- Główny cel: wprowadzenie PIN-u lub tokenu magic link.
- Kluczowe informacje: numer PIN, przypomnienie o ograniczonym czasie ważności.
- Kluczowe komponenty: keypad numeryczny, licznik prób, wsparcie QR/token.
- UX/dostępność/bezpieczeństwo: tryb pełnoekranowy, komunikaty dostępne dla screen readerów, blokada po 5 nieudanych próbach zgodnie z RLS.

### Onboarding Krok 1 – Rodzina i dzieci
- Ścieżka: `/onboarding/family`
- Status: ✅ Widok wdrożony (formularz danych rodziny + lista/prosty CRUD dzieci z akcjami serwerowymi)
- Główny cel: konfiguracja rodziny i utworzenie minimum jednego profilu dziecka.
- Kluczowe informacje: nazwa rodziny, strefa czasowa, lista dzieci (imię, avatar, PIN).
- Kluczowe komponenty: formularz rodziny, dynamiczna lista dzieci, walidatory unikalności PIN.
- UX/dostępność/bezpieczeństwo: możliwość pominięcia dodatkowych dzieci, autosave po każdej zmianie, maskowanie PIN-u, komunikaty o błędach w aria-live.

### Onboarding Krok 2 – Rutyny i zadania
- Ścieżka: `/onboarding/routines`
- Status: ✅ Formularz konfiguracji rutyn z wyborem godzin i kopiowaniem zadań z szablonów
- Główny cel: wybór ram czasowych rutyn i kopiowanie zadań z szablonów.
- Kluczowe informacje: lista rutyn (poranna/popołudniowa/wieczorna), template zadań (nazwa, punkty), preview dzienny.
- Kluczowe komponenty: time pickery, grid szablonów, wielokrotne checkboxy „Kopiuj do rutyny”, edycja inline punktów, podsumowanie.
- UX/dostępność/bezpieczeństwo: responsywne formularze, obsługa klawiatury, guard przed opuszczeniem strony bez zapisu, walidacja sekwencji zadań.

### Onboarding Krok 3 – Nagrody
- Ścieżka: `/onboarding/rewards`
- Główny cel: wybór nagród startowych z katalogu szablonów.
- Kluczowe informacje: karty nagród (nazwa, cena, grafika/placeholder), możliwość dodania własnej nagrody.
- Kluczowe komponenty: grid kart z checkboxem, formularz „Dodaj własną nagrodę”, toast potwierdzający dodanie.
- UX/dostępność/bezpieczeństwo: lazy loading obrazów z placeholderem, opisy alternatywne, walidacja ceny (>0), końcowe podsumowanie z CTA „Zakończ onboarding”.

### Panel Rodzica – Layout
- Ścieżka: `/parent` (layout)
- Status: ✅ Minimalny layout z nagłówkiem, banerem sieci i skrótem do onboardingu
- Główny cel: wspólna nawigacja dla widoków rodzica.
- Kluczowe informacje: menu boczne (Dashboard, Rutyny, Nagrody, Dzieci, Ustawienia), status sesji.
- Kluczowe komponenty: AppShellParent, breadcrumbs, przełącznik roli.
- UX/dostępność/bezpieczeństwo: sticky sidebar desktop, sheet mobilny, wskaźnik wygaśnięcia sesji, wymaganie JWT.

### Dashboard Rodzica
- Ścieżka: `/parent/dashboard`
- Status: ✅ Widok startowy (placeholder) z wykrywaniem statusu onboardingu i CTA do dokończenia konfiguracji
- Główny cel: szybki wgląd w postęp dziecka dziś i wczoraj.
- Kluczowe informacje: karty „Dziś” i „Wczoraj” z paskami postępu rutyn, KPI (czas średni, punkty), selektor dat, log ostatnich nagród.
- Kluczowe komponenty: cards, progress bars, date picker, taby.
- UX/dostępność/bezpieczeństwo: skeletony podczas ładowania, aria-describedby dla wykresów, fallback offline, odświeżanie manualne.

### Zarządzanie Rutynami – Lista
- Ścieżka: `/parent/routines`
- Główny cel: przegląd rutyn i szybkie akcje edycji.
- Kluczowe informacje: zestaw rutyn z oknami czasowymi, liczbą zadań, przypisanymi dziećmi.
- Kluczowe komponenty: tabela, przyciski akcji, filtr po dziecku.
- UX/dostępność/bezpieczeństwo: sortowanie, paginacja, potwierdzenia przy usuwaniu, prawo dostępu ograniczone RLS.

### Szczegóły Rutyny
- Ścieżka: `/parent/routines/[routineId]`
- Główny cel: edycja zadań i przypisań danej rutyny.
- Kluczowe informacje: lista zadań z kolejnością, punktami, statusem; przypisane dzieci.
- Kluczowe komponenty: drag-and-drop list, edytor zadania, modal dodawania zadań z szablonów.
- UX/dostępność/bezpieczeństwo: wskaźnik offline, potwierdzenia przy zmianie kolejności, walidacja pozycji.

### Konfiguracja Rutyny per Dziecko
- Ścieżka: `/parent/routines/[routineId]/children/[childId]`
- Główny cel: dostosowanie zadań i kolejności dla konkretnego dziecka.
- Kluczowe informacje: personalizowana lista zadań, opcjonalne wyłączenia, podgląd punktów.
- Kluczowe komponenty: checklista, input punktów, info o rekordach dziecka.
- UX/dostępność/bezpieczeństwo: informacja o dziedziczeniu z rutyny bazowej, ostrzeżenie przed dezaktywacją podczas aktywnej sesji.

### Katalog Nagród Rodzica
- Ścieżka: `/parent/rewards`
- Główny cel: zarządzanie katalogiem nagród.
- Kluczowe informacje: lista nagród (źródło standard/custom, cena, stan), akcje aktywacji/dezaktywacji.
- Kluczowe komponenty: grid kart, modal edycji, uploader obrazu.
- UX/dostępność/bezpieczeństwo: placeholder obrazów, walidacja kosztu, badge źródła, wersjonowanie URL przy aktualizacji.

### Profile Dzieci i Tokeny
- Ścieżka: `/parent/children`
- Główny cel: zarządzanie profilami dzieci i dostępami.
- Kluczowe informacje: dane profili, status tokenu, liczba nieudanych prób PIN.
- Kluczowe komponenty: lista kart, przyciski generowania tokenu, QR modal.
- UX/dostępność/bezpieczeństwo: ostrzeżenia o wygaśnięciu tokenu, maskowanie PIN, możliwość resetu prób.

### Ustawienia Rodziny
- Ścieżka: `/parent/settings`
- Główny cel: aktualizacja nazwy rodziny, strefy czasowej, preferencji powiadomień.
- Kluczowe informacje: formularz, przełączniki, status onboarding.
- Kluczowe komponenty: form sections, toggle, save banner.
- UX/dostępność/bezpieczeństwo: walidacja strefy czasowej, ostrzeżenie przed zmianą wpływającą na rutyny, confirm modal.

### Interfejs Dziecka – Layout
- Ścieżka: `/child` (layout)
- Główny cel: nawigacja po widokach dziecka z punktem nacisku na fullscreen mobile.
- Kluczowe informacje: saldo punktów, status sieci, przycisk powrotu do roli.
- Kluczowe komponenty: AppShellChild, PointsBadge, OfflineBanner.
- UX/dostępność/bezpieczeństwo: duże czcionki, tryb wysokiego kontrastu, automatyczne wylogowanie po TTL.

### Tablica Rutyn Dziecka
- Ścieżka: `/child/home`
- Główny cel: wybór aktywnej rutyny (dziś, zbliżające się, zakończone).
- Kluczowe informacje: trzy rutyny z oznaczeniem statusu, czas pozostały, nagrody dostępne.
- Kluczowe komponenty: card-stack, countdown, CTA „Start”.
- UX/dostępność/bezpieczeństwo: kolorystyczne oznaczenia stanu, głosowe ogłoszenia (aria-live) przy zmianie statusu, blokada rutyny spoza okna czasowego.

### Aktywna Rutyna
- Ścieżka: `/child/routines/[routineSessionId]`
- Główny cel: prowadzenie dziecka krok po kroku przez zadania.
- Kluczowe informacje: pełna lista zadań, podświetlenie bieżącego, timer, punkty sesji, offline status.
- Kluczowe komponenty: SequentialTaskList, Timer, ProgressTracker, komponent kolejki offline.
- UX/dostępność/bezpieczeństwo: interakcje tylko z aktualnym zadaniem, potwierdzenia dźwiękowe, tryb offline z retry, blokada przy braku synchronizacji po limicie.

### Ekran Sukcesu Rutyny
- Ścieżka: `/child/routines/[routineSessionId]/success`
- Główny cel: świętowanie ukończenia rutyny i kierowanie do nagród.
- Kluczowe informacje: czas rutyny, porównanie rekordu, zdobyte odznaki, punkty, komunikat o kolejnej rutynie z godziną i countdown.
- Kluczowe komponenty: celebratory animation, stats cards, CTA „Zobacz nagrody”, CTA „Wróć do rutyn”.
- UX/dostępność/bezpieczeństwo: opcja wyciszenia animacji, tekst alternatywny, logowanie zdarzeń analitycznych.

### Sklep z Nagrodami Dziecka
- Ścieżka: `/child/rewards`
- Główny cel: przeglądanie i wymiana punktów na nagrody.
- Kluczowe informacje: siatka nagród (nazwa, cena, obraz, badge źródła), status dostępności.
- Kluczowe komponenty: RewardGrid, modal potwierdzenia wymiany, saldo punktów.
- UX/dostępność/bezpieczeństwo: dezaktywacja nagród powyżej salda, confirm dialog, logowanie metrów.

### Profil i Osiągnięcia Dziecka
- Ścieżka: `/child/profile`
- Główny cel: przegląd zdobytych odznak i statystyk.
- Kluczowe informacje: galeria odznak, historia rutyn, licznik serii.
- Kluczowe komponenty: badge gallery, timeline, share modal (opcjonalnie).
- UX/dostępność/bezpieczeństwo: opisy alt dla odznak, dostęp do historii offline, brak wrażliwych danych.

### Obsługa Błędów / Offline
- Ścieżka: `/error`, komponenty fallback w layoutach
- Główny cel: prezentacja błędów globalnych i stanu offline.
- Kluczowe informacje: kod błędu, opis, CTA „Spróbuj ponownie”/„Kontakt”.
- Kluczowe komponenty: ErrorBoundary, OfflineQueueStatus, RetryButton.
- UX/dostępność/bezpieczeństwo: aria-live, link do wsparcia, brak ujawniania szczegółów technicznych.

## 3. Mapa podróży użytkownika

- **Rodzic (onboarding)**: `/` → `/auth/parent` → `/onboarding/family` (dodanie dziecka) → `/onboarding/routines` (wybór szablonów) → `/onboarding/rewards` → redirect do `/parent/dashboard`.
- **Rodzic (codzienna kontrola)**: `/parent/dashboard` (przegląd dziś/wczoraj) → opcjonalnie `/parent/routines` (dostosowanie zadań) → `/parent/rewards` (edycja nagród) → `/parent/children` (reset tokenu) → powrót do dashboardu.
- **Dziecko (wykonanie rutyny)**: `/` → `/auth/child` → `/child/home` (wybór aktywnej rutyny) → `/child/routines/[session]` (sekwencja zadań) → `/child/routines/[session]/success` (podsumowanie) → CTA „Zobacz nagrody” → `/child/rewards` → powrót do `/child/home`.
- **Scenariusze dodatkowe**: błąd sieci podczas rutyny aktywuje banner offline i kolejkę; rodzic, próbując przejść do interfejsu dziecka, wybiera dziecko na `/parent/dashboard` (przycisk „Wejdź jako dziecko”) → generowany krótkotrwały token i redirect do `/child/home`.

## 4. Układ i struktura nawigacji

- **Top-level App Router**: `/(public)` dla ekranów roli/logowania, `/onboarding` (chroniony dla rodzica bez zakończonego onboarding), `/parent` (chroniony JWT), `/child` (chroniony tokenem dziecka).
- **Nawigacja rodzica**: sidebar z sekcjami (Dashboard, Rutyny, Nagrody, Dzieci, Ustawienia); breadcrumbs w widokach zagnieżdżonych; mobilnie – menu hamburger otwierające sheet.
- **Nawigacja dziecka**: dolny pasek/pływający przycisk (Home, Rutyny, Nagrody, Profil); w aktywnej rutynie brak innych elementów, aby uniknąć rozproszenia; CTA powrotu na ekran sukcesu.
- **Przekierowania bezpieczeństwa**: middleware weryfikuje rolę; brak ważnej sesji → redirect na odpowiedni ekran logowania; wygaszenie tokenu dziecka → modal z informacją i powrotem na `/`.

## 5. Kluczowe komponenty

- **AppShellParent/AppShellChild** – layouty z menu, guardami sesji, wskaźnikiem offline.
- **RoleGateMiddleware** – logika Next.js zapewniająca routing zgodnie z rolą (parent/child).
- **WizardStepper** – komponent prowadzący onboarding z autosave i wskaźnikiem postępu.
- **TemplatePicker** – grid kart z checkboxami i edycją inline dla zadań/nagród.
- **SequentialTaskList** – lista zadań z podświetleniem aktywnego elementu i obsługą offline queue.
- **TimerDisplay** – licznik czasu rutyny z porównaniem rekordu.
- **PointsBadge** – stałe wyświetlanie salda punktów z możliwością otwarcia sklepu.
- **RewardGrid** – responsywne karty nagród z placeholderami, badge źródła, stanem dostępności.
- **AnalyticsTracker** – wrapper wysyłający zdarzenia do Vercel Analytics zgodnie z konwencją.
- **OfflineQueueBanner** – komponent informujący o stanie bufora, retry i blokadach nowych rutyn.
- **ErrorFallback** – spójny komponent błędów z kodem, opisem i CTA.
