# API Endpoint Implementation Plan: GET /families/{familyId}/progress

## 1. Przegląd punktu końcowego
- Zapewnia dzienny widok postępów rutyn rodziny dla dashboardu rodzica.
- Łączy dane z `routines`, `routine_sessions`, `routine_tasks` i `task_completions`, zachowując kontekst dziecka.
- Obsługuje filtr daty (domyślnie dziś) oraz opcjonalne dołączenie podsumowania poprzedniego dnia.
- W odpowiedzi zwraca dane zgodne z `FamilyProgressSummaryDto`, gotowe do renderowania UI.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`.
- Struktura URL: `/api/v1/families/{familyId}/progress` (`src/app/api/v1/families/[familyId]/progress/route.ts`).
- Parametry ścieżki: `familyId` (UUID, wymagane; musi odpowiadać rodzinie powiązanej z tokenem).
- Parametry zapytania: `date` (`YYYY-MM-DD`, opcjonalny; maks. dziś, co najwyżej 30 dni wstecz), `includeHistory` (`boolean`, opcjonalny; domyślnie `false`).
- Nagłówki: `Authorization: Bearer <Supabase JWT>`; opcjonalnie `If-None-Match` dla obsługi ETag.

## 3. Szczegóły odpowiedzi
- Status sukcesu: `200 OK` (zwraca pustą strukturę przy braku danych; `date` odzwierciedla żądaną wartość).
- Wykorzystywane typy: `FamilyProgressSummaryDto` oraz zagnieżdżone `FamilyProgressRoutineSummaryDto`, `FamilyProgressChildSummaryDto`, `FamilyProgressTaskSummaryDto`.
- Rozszerzenie dla historii: `history?: { previousDay?: FamilyProgressSummaryDto }` zwracane gdy `includeHistory=true` i dane istnieją.
- Pola nullowalne: `sessionId`, `durationSeconds`, `tasks` (jeśli brak zadań → `[]`).
- Kształt odpowiedzi:
  ```json
  {
    "date": "2024-04-01",
    "routines": [...],
    "history": {
      "previousDay": { "date": "2024-03-31", "routines": [...] }
    }
  }
  ```

## 4. Przepływ danych
- Handler Next.js pobiera Supabase client poprzez helper uwierzytelniający, waliduje parametry i claims JWT.
- Serwis `familyProgressService.getDailySummary` wywołuje zapytanie (widok SQL lub RPC) filtrujące po `family_id`, `session_date`.
- Serwis mapuje rekordy do struktur DTO, dokleja dane historyczne poprzez drugie wywołanie przy `includeHistory`.
- Handler formatuje odpowiedź, ustawia nagłówki (`Cache-Control`, `ETag`/`Last-Modified`) i zwraca wynik.

## 5. Względy bezpieczeństwa
- Wymuś uwierzytelnienie Supabase JWT oraz sprawdzanie `role` ∈ {`parent`, `admin`} dla dostępu.
- Zweryfikuj zgodność `familyId` z `profiles.family_id` pobranym z tokena lub profilu bazodanowego.
- Korzystaj z RLS poprzez standardowego klienta Supabase; zapytania nie mogą używać service role.
- Dodaj middleware limitujący liczbę żądań, aby chronić agregację przed nadużyciami.

## 6. Obsługa błędów
- `400 Bad Request`: niepoprawny UUID, błędny format daty, data poza dozwolonym zakresem, nieprawidłowa wartość `includeHistory`.
- `401 Unauthorized`: brak nagłówka `Authorization` lub nieprawidłowy token.
- `403 Forbidden`: token nie odpowiada rodzinie lub rola użytkownika nie ma uprawnień.
- `404 Not Found`: opcjonalnie przy braku rodziny; preferowane `200` z pustymi danymi — potwierdzić z produktem.
- `500 Internal Server Error`: błędy Supabase/RPC; logować szczegóły oraz zwracać generyczny komunikat.

## 7. Wydajność
- Utwórz zoptymalizowany widok SQL lub RPC łączący wymagane tabele z filtrami po indeksowanych kolumnach (`family_id`, `session_date`).
- Zastosuj ETag (`hash` danych) i `Cache-Control: private, max-age=30` dla krótkotrwałego cache po stronie klienta.
- Wymuś limit czasu i paginację przy pobieraniu historii (re-użyj `family_points_snapshots` dla metryk).
- Re-używaj wyników w pamięci (np. `edge-cache`) w ramach tego samego żądania przy pobieraniu danych historycznych.

## 8. Kroki implementacji
1. Zdefiniuj/rozszerz typy w `src/types.ts` (np. `FamilyProgressSummaryWithHistoryDto`, zapytanie wejściowe).
2. Przygotuj widok SQL lub funkcję RPC (`family_daily_progress`) agregującą dane i uwzględniającą soft delete.
3. Dodaj moduł `src/app/api/_services/familyProgressService.ts` z metodami `getDailySummary` oraz `getPreviousDaySummary`.
4. Zaimplementuj validatory (np. `zod`) dla `familyId`, `date`, `includeHistory` oraz helper ustalający domyślne wartości.
5. Utwórz handler `route.ts`, pobierz autoryzowanego użytkownika, sprawdź przynależność do rodziny, wywołaj serwis i mapuj wynik.
6. Dodaj obsługę nagłówków `ETag`, `Cache-Control`, konwersję do struktur DTO i fallback do pustych tablic.
7. Zapisuj błędy do loggera (Sentry/console) i zwracaj ustandaryzowane odpowiedzi `error.code` / `error.message`.
8. Uaktualnij dokumentację OpenAPI/Swagger i scenariusze testowe (manualne + przyszłe automatyczne) dla różnych wariantów parametrów.

# API Endpoint Implementation Plan: POST /children/{childId}/sessions

## 1. Przegląd punktu końcowego
- Startuje dzienną sesję rutyny dla konkretnego dziecka, ustawiając status `in_progress` i planowany czas zakończenia.
- Inicjuje sekwencję zadań zgodną z konfiguracją `routine_tasks`, opcjonalnie uruchamia timer.
- Zapewnia spójność danych z `routine_sessions`, `routine_tasks`, `child_routines` i `point_transactions`.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`.
- Struktura URL: `/api/v1/children/{childId}/sessions` (`src/app/api/v1/children/[childId]/sessions/route.ts`).
- Parametry ścieżki: `childId` (UUID, wymagany; musi być dzieckiem w rodzinie zalogowanego użytkownika).
- Parametry zapytania: brak.
- Request body (`RoutineSessionCreateCommand`): `routineId` (UUID, wymagany), `sessionDate` (`YYYY-MM-DD`, wymagany, w strefie rodziny), `autoStartTimer` (boolean, opcjonalny; domyślnie `false`).
- Nagłówki: `Authorization: Bearer <Supabase JWT>` (rola `parent` lub upoważniony `child`), `Content-Type: application/json`.

## 3. Szczegóły odpowiedzi
- Status sukcesu: `201 Created`.
- Struktura (`RoutineSessionStartDto`):
  ```json
  {
    "id": "uuid",
    "status": "in_progress",
    "startedAt": "ISO-8601",
    "plannedEndAt": "ISO-8601",
    "taskOrder": [
      { "taskId": "uuid", "position": 1 }
    ]
  }
  ```
- Przy braku aktywnych zadań zwraca pustą tablicę `taskOrder`.

## 4. Przepływ danych
- Handler waliduje parametry (`zod`), pobiera profil z Supabase, sprawdza zgodność `childId` z rodziną oraz rolę tokena.
- `routineSessionService.start` w transakcji: weryfikuje brak istniejącej sesji `in_progress` dla `(childId, routineId, sessionDate)`, pobiera konfigurację rutyny oraz zadania, wylicza `planned_end_at` (na podstawie `expected_duration_seconds` lub domyślnego okna rutyny).
- Tworzy wpis w `routine_sessions`, ustawia `started_at`, `status`, `planned_end_at`, generuje kolejność zadań.
- Zwraca zmapowany `RoutineSessionStartDto`; handler ustawia `Cache-Control: no-store`.

## 5. Względy bezpieczeństwa
- Wymagaj JWT z `role` ∈ {`parent`, `admin`} dla tworzenia sesji; dziecko może wołać jedynie, jeśli polityka dopuszcza (sprawdzenie `profile_id`).
- Korzystaj z Supabase klienta z RLS; nie używać service role.
- Waliduj, że `routineId` oraz `childId` należą do tej samej rodziny; broni przed atakiem enumeracyjnym.
- Dodaj rate limit (np. 10 żądań/min na rodzinę) by zapobiec spamowaniu sesji.

## 6. Obsługa błędów
- `400 Bad Request`: błędny UUID, data wykraczająca poza okno, `routineId` nieaktywny.
- `401 Unauthorized`: brak/niepoprawny token.
- `403 Forbidden`: profil nie należy do rodziny lub rola niewystarczająca.
- `404 Not Found`: brak rutyny lub dziecka w systemie.
- `409 Conflict`: istnieje aktywna sesja dla danej pary lub konflikt transakcji.
- `500 Internal Server Error`: błąd Supabase, logować (Sentry/console) z kontekstem requestu.

## 7. Rozważania dotyczące wydajności
- Wykorzystaj indeks `routine_sessions_child_date_idx`; ogranicz selekcje do pojedynczej daty.
- Cache'uj konfigurację rutyny/zadań w pamięci (np. LRU) aby zredukować odczyty przy wielu startach.
- Minimalizuj liczbę zapytań: pobierz zadania jednym joinem (`routine_tasks` filtrowane po `routine_id`, `child_profile_id`, `is_active`).
- Zadbaj o idempotencję — sprawdzenie istniejącej sesji przed tworzeniem ogranicza powtórne wywołania.

## 8. Etapy wdrożenia
1. Dodaj helper walidujący `childId` i `routineId` (UUID + zgodność rodziny).
2. Utwórz `routineSessionService.start` (Supabase RPC lub transakcje) z logiką weryfikacji i tworzenia rekordów.
3. Rozszerz `src/types.ts` o ewentualne typy pomocnicze (np. `RoutineSessionStartResponseDto` jeśli potrzebne aliasy).
4. Zaimplementuj handler `route.ts`, wstrzyknij Supabase client, wywołaj serwis, zwróć DTO.
5. Dodaj logowanie błędów oraz mapowanie wyjątków na kody HTTP (używając wspólnej utilki `mapSupabaseError`).
6. Uzupełnij dokumentację OpenAPI + scenariusze testowe (start sesji udany, duplikat, brak uprawnień).

# API Endpoint Implementation Plan: POST /sessions/{sessionId}/tasks/{taskId}/complete

## 1. Przegląd punktu końcowego
- Oznacza pojedyncze zadanie jako ukończone w aktywnej sesji rutyny.
- Aktualizuje `task_completions`, zachowuje kolejność wykonywania i nalicza punkty cząstkowe.
- Wspiera interfejs dziecka, umożliwiając progresywne odblokowywanie kolejnych zadań.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`.
- Struktura URL: `/api/v1/sessions/{sessionId}/tasks/{taskId}/complete` (`src/app/api/v1/sessions/[sessionId]/tasks/[taskId]/complete/route.ts`).
- Parametry ścieżki: `sessionId` (UUID, wymagany), `taskId` (UUID, wymagany).
- Parametry zapytania: brak.
- Request body (`TaskCompletionCommand`): `completedAt` (ISO-8601, wymagany, ≥ `session.started_at`), `notes` (JSON/tekst, opcjonalne).
- Nagłówki: `Authorization: Bearer <Supabase JWT>`, `Content-Type: application/json`.

## 3. Szczegóły odpowiedzi
- Status sukcesu: `200 OK`.
- Struktura (`TaskCompletionResultDto`):
  ```json
  {
    "taskCompletionId": "uuid",
    "position": 1,
    "status": "completed"
  }
  ```
- Przy wielokrotnym wywołaniu zwróci istniejący `taskCompletionId` (idempotencja) lub błąd konfliktu.

## 4. Przepływ danych
- Handler waliduje parametry, pobiera sesję i upewnia się, że `status = in_progress`.
- `taskCompletionService.complete`:
  - W transakcji blokuje aktualną i następną pozycję (`FOR UPDATE`) aby uniknąć wyścigów.
  - Sprawdza czy zadanie należy do tej sesji (`routine_tasks.child_profile_id = session.child_profile_id`) i czy poprzednie zadanie jest zakończone (API Plan §4 “Task Completion”).
  - Wstawia rekord do `task_completions` z `position`, `completed_at`, `metadata`.
  - Aktualizuje kumulację punktów (`routine_sessions.points_awarded += task.points`), jeżeli wymagane.
- Handler zwraca DTO; brak cache (operacja mutująca).

## 5. Względy bezpieczeństwa
- RLS wymusza, że dziecko może dotknąć tylko swoich sesji; mimo to dodatkowo sprawdzać `profile_id` z JWT.
- Rodzic z rolą `parent` może potwierdzać zadania tylko dla dzieci z rodziny.
- Waliduj `notes` aby uniknąć injection (sanitize JSON).
- Limituj częstotliwość (np. 30 żądań/min na sesję) by zapobiegać spamowi.

## 6. Obsługa błędów
- `400 Bad Request`: brak `completedAt`, wartość przed startem sesji, payload niezgodny ze schematem.
- `401 Unauthorized`: brak ważnego tokena.
- `403 Forbidden`: próba dostępu do obcej sesji lub z roli nieuprawnionej.
- `404 Not Found`: sesja lub zadanie nie istnieją / nie powiązane.
- `409 Conflict`: zadanie już ukończone, wykonane poza kolejnością, sesja nie w `in_progress`.
- `500 Internal Server Error`: błąd transakcji/połączenia; logować w Sentry wraz z identyfikatorami.

## 7. Rozważania dotyczące wydajności
- Użyj indeksu `task_completions_session_order_idx` dla pobierania statusu poprzednich zadań.
- Zoptymalizuj zapytania do `routine_tasks` (select tylko `id`, `position`, `is_optional`, `points`).
- Transakcje krótkotrwałe; rozważ optimistic locking (sprawdzanie `updated_at` sesji).
- Rozważ prefetching statusów w pamięci klienta, ale API powinno zapewniać minimalny payload.

## 8. Etapy wdrożenia
1. Dodaj walidatory wejścia (`sessionId`, `taskId`, schema body).
2. Utwórz `taskCompletionService.complete` z transakcją Supabase (RPC lub `pg`).
3. Zapewnij funkcję sprawdzającą sekwencyjność (SQL `NOT EXISTS` na niższej pozycji bez completion).
4. Zaimplementuj handler `route.ts`, mapuj wyniki serwisu na DTO.
5. Dodaj logowanie wyjątków i mapowanie na kody HTTP.
6. Rozszerz dokumentację i testy (scenariusz sukcesu, out-of-order, double submit, brak uprawnień).

# API Endpoint Implementation Plan: POST /sessions/{sessionId}/complete

## 1. Przegląd punktu końcowego
- Finalizuje aktywną sesję rutyny, wylicza czas trwania, bonus punktowy i zapisuje transakcję punktów.
- Aktualizuje statystyki wydajności (`routine_performance_stats`) i kończy przepływ UI dla dziecka.
- Zapewnia atomową konsolidację stanu z `task_completions`, `routine_sessions` i `point_transactions`.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`.
- Struktura URL: `/api/v1/sessions/{sessionId}/complete` (`src/app/api/v1/sessions/[sessionId]/complete/route.ts`).
- Parametry ścieżki: `sessionId` (UUID, wymagany).
- Parametry zapytania: brak.
- Request body (`CompleteRoutineSessionCommand`):
  ```json
  {
    "completedTasks": [
      { "taskId": "uuid", "completedAt": "ISO-8601" }
    ],
    "bestTimeBeaten": true
  }
  ```
  - `completedTasks` wymagane; musi zawierać wszystkie aktywne zadania w kolejności wykonania.
  - `bestTimeBeaten` opcjonalne; jeśli true, stosuje podwójne punkty.
- Nagłówki: `Authorization: Bearer <Supabase JWT>`, `Content-Type: application/json`.

## 3. Szczegóły odpowiedzi
- Status sukcesu: `200 OK`.
- Struktura (`RoutineSessionCompletionDto`):
  ```json
  {
    "status": "completed",
    "completedAt": "ISO-8601",
    "durationSeconds": 900,
    "pointsAwarded": 120,
    "bonusMultiplier": 2.0,
    "pointTransactionId": "uuid"
  }
  ```
- Jeśli bonus nie został pobity, `bonusMultiplier` pozostaje `1.0`, `pointTransactionId` może być `null` gdy transakcja nie została wygenerowana.

## 4. Przepływ danych
- Handler waliduje wejście, pobiera sesję z Supabase i upewnia się, że `status = in_progress`.
- `routineSessionService.complete` (transakcja):
  - Porównuje przekazane `completedTasks` z rzeczywistymi zadaniami (`routine_tasks`), tworzy brakujące rekordy w `task_completions` (lub aktualizuje istniejące).
  - Wylicza `duration_seconds` (`max(completedAt) - started_at`), ustawia `completed_at`, `status=completed`, `best_time_beaten`.
  - Aktualizuje `routine_performance_stats` (best time, streak) zgodnie ze spec (API Plan §4).
  - Tworzy wpis w `point_transactions` (`transaction_type = routine_bonus/task_completion`), zapewniając `balance_after ≥ 0`.
  - Zwraca dane do mapowania na DTO.
- Handler ustawia nagłówki `Cache-Control: no-store`, zwraca wynik.

## 5. Względy bezpieczeństwa
- Dostęp tylko dla rodziców lub dziecka przypisanego do sesji (sprawdzenie `profile_id` vs `child_profile_id`).
- Walidacja inputu chroniąca przed manipulacją punktami (np. powtórne zgłoszenie tych samych zadań).
- Zabezpiecz transakcję przed równoczesnym auto-close (Edge Function) poprzez blokadę rekordu sesji.
- Loguj wszystkie finalizacje dla audytu (zmiana punktów).

## 6. Obsługa błędów
- `400 Bad Request`: brak wymaganych pól, `completedTasks` nie zawiera wszystkich zadań, czasy poza zakresem.
- `401 Unauthorized`: brak ważnego tokena.
- `403 Forbidden`: próba zakończenia obcej sesji lub przez nieuprawnionego użytkownika.
- `404 Not Found`: sesja nie istnieje lub już zarchiwizowana.
- `409 Conflict`: sesja już zakończona/auto-closed, konflikt aktualizacji podczas równoległej operacji.
- `500 Internal Server Error`: błędy bazodanowe, nieudane utworzenie transakcji punktowej; logować z identyfikatorami.

## 7. Rozważania dotyczące wydajności
- Wykorzystaj pojedynczą transakcję, aby zminimalizować round-trips (np. RPC wykonujące multi-step SQL).
- Przed finalizacją pobierz wszystkie `task_completions` w jednym zapytaniu, użyj indeksu `task_completions_session_order_idx`.
- Aktualizacje `routine_performance_stats` powinny korzystać z indeksu `routine_performance_stats_child_idx`.
- Rozważ idempotentną obsługę powtórnych wywołań (sprawdzanie `status` przed działaniem).

## 8. Etapy wdrożenia
1. Przygotuj schemat walidacji body (`completedTasks` niepuste, unikalne `taskId`, poprawne ISO daty).
2. Rozszerz `routineSessionService` o metodę `complete`, tworząc Supabase RPC/SQL script wykonywany w transakcji.
3. Zapewnij funkcje pomocnicze dla aktualizacji `routine_performance_stats` i `point_transactions`.
4. Utwórz handler `route.ts`, obsłuż mapowanie DTO oraz błędów.
5. Dodaj logowanie audytowe (np. `console.error` + Sentry) przy niepowodzeniach transakcji.
6. Zaktualizuj dokumentację i testy manualne: scenariusz sukcesu, duplikat finalizacji, brak kompletu zadań, równoległy auto-close.

# API Endpoint Implementation Plan: GET /children/{childId}/sessions

## 1. Przegląd punktu końcowego
- Zapewnia widok listy sesji rutyn danego dziecka dla UI rodzica/dziecka.
- Obsługuje filtrowanie po statusie, dacie, rutynie oraz paginację i sortowanie.
- Wspiera monitorowanie postępów i historii, wykorzystując dane z `routine_sessions`.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`.
- Struktura URL: `/api/v1/children/{childId}/sessions` (`src/app/api/v1/children/[childId]/sessions/route.ts`).
- Parametry ścieżki: `childId` (UUID, wymagany).
- Parametry zapytania (opcjonalne):
  - `status` (`scheduled|in_progress|completed|auto_closed|skipped|expired`).
  - `fromDate`, `toDate` (`YYYY-MM-DD`; waliduj zakres ≤ 30 dni oraz `fromDate ≤ toDate`).
  - `routineId` (UUID).
  - `page` (number ≥1, domyślnie 1), `pageSize` (1–100, domyślnie 25).
  - `sort` (`sessionDate|startedAt|completedAt`, domyślnie `sessionDate`), `order` (`asc|desc`, domyślnie `desc`).
- Nagłówki: `Authorization: Bearer <Supabase JWT>`.

## 3. Szczegóły odpowiedzi
- Status sukcesu: `200 OK`.
- Struktura (`RoutineSessionListResponseDto`):
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "routineId": "uuid",
        "sessionDate": "2024-04-01",
        "status": "completed",
        "startedAt": "ISO-8601",
        "completedAt": "ISO-8601",
        "durationSeconds": 900,
        "pointsAwarded": 120,
        "bonusMultiplier": 2.0
      }
    ],
    "meta": {
      "page": 1,
      "pageSize": 25,
      "total": 12
    }
  }
  ```
- Przy braku wyników `data: []`, `total: 0`.

## 4. Przepływ danych
- Handler waliduje `childId` i parametry zapytania (Zod).
- `routineSessionService.listForChild` buduje zapytanie Supabase z filtrami oraz `order`.
- Serwis wykorzystuje indeks `routine_sessions_child_date_idx` i paginację `range`.
- Wynik mapowany do `RoutineSessionSummaryDto`, meta obliczana z `count`.
- Handler ustawia `Cache-Control: private, max-age=30`.

## 5. Względy bezpieczeństwa
- Upewnij się, że token (rola `parent` lub `child`) odpowiada rodzinie dziecka (`profiles.family_id`).
- Dziecko może przeglądać tylko własne sesje (`profile_id` w JWT), rodzic dowolne dziecko w rodzinie.
- Rate limiting (np. 60 req/min/IP) zapobiega enumeracji.
- Brak service role – korzystamy z klienta przestrzegającego RLS.

## 6. Obsługa błędów
- `400 Bad Request`: błędne UUID / format daty, `pageSize > 100`, `fromDate > toDate`, `sort` poza enumeracją.
- `401 Unauthorized`: brak ważnego tokena.
- `403 Forbidden`: dziecko próbujące podejrzeć inną rodzinę lub rodzic spoza rodziny.
- `404 Not Found`: opcjonalnie gdy `childId` nie istnieje (rozważyć `403` by nie ujawniać).
- `500 Internal Server Error`: błąd Supabase (log z kontekstem zapytania).

## 7. Rozważania dotyczące wydajności
- Filtrowanie po indeksowanych kolumnach (`child_profile_id`, `session_date`, `status`).
- Wymuś limity paginacji, unikaj `total` przy dużych zakresach (opcjonalny parametr `includeTotal`?).
- Rozważ caching wyników krótkotrwałych po stronie CDN per użytkownik.
- Batchowanie zapytań (jedno zapytanie z `select` i `count` w Supabase).

## 8. Etapy wdrożenia
1. Dodaj schemat walidacji query (Zod) i helper normalizujący daty, paginację.
2. Zaimplementuj `routineSessionService.listForChild` (budowa zapytania Supabase).
3. Dodaj mapowanie rekordów do DTO oraz funkcję przygotowującą `meta`.
4. Zaimplementuj handler GET w `route.ts` obok istniejącego POST; współdziel walidację kontekstu dziecka.
5. Dodaj logowanie błędów i mapowanie wyjątków na kody HTTP.
6. Uaktualnij dokumentację OpenAPI i przypadki testowe (różne filtry, brak uprawnień, limit paginacji).

# API Endpoint Implementation Plan: GET /sessions/{sessionId}

## 1. Przegląd punktu końcowego
- Dostarcza szczegółowe dane pojedynczej sesji rutyny, w tym zadania i statystyki wydajności.
- Umożliwia UI wyświetlenie przebiegu sesji oraz parametrów nagradzania.
- Wspiera zarówno rodzica (wgląd audytowy), jak i dziecko (przegląd postępów).

## 2. Szczegóły żądania
- Metoda HTTP: `GET`.
- Struktura URL: `/api/v1/sessions/{sessionId}` (`src/app/api/v1/sessions/[sessionId]/route.ts`).
- Parametry ścieżki: `sessionId` (UUID, wymagany).
- Parametry zapytania (opcjonalne):
  - `includeTasks` (`boolean`, domyślnie `true`).
  - `includePerformance` (`boolean`, domyślnie `true`).
- Nagłówki: `Authorization: Bearer <Supabase JWT>`.

## 3. Szczegóły odpowiedzi
- Status sukcesu: `200 OK`.
- Struktura (`RoutineSessionDetailsDto`):
  ```json
  {
    "id": "uuid",
    "routineId": "uuid",
    "childProfileId": "uuid",
    "sessionDate": "2024-04-01",
    "status": "completed",
    "startedAt": "ISO-8601",
    "completedAt": "ISO-8601",
    "durationSeconds": 900,
    "pointsAwarded": 120,
    "bonusMultiplier": 2.0,
    "bestTimeBeaten": true,
    "tasks": [
      {
        "taskId": "uuid",
        "name": "Brush teeth",
        "status": "completed",
        "completedAt": "ISO-8601"
      }
    ],
    "performance": {
      "routineId": "uuid",
      "bestDurationSeconds": 850,
      "bestSessionId": "uuid",
      "lastCompletedAt": "ISO-8601",
      "streakDays": 3
    }
  }
  ```
- Jeśli `includeTasks=false`, pole `tasks` pomijane; analogicznie dla `performance`.

## 4. Przepływ danych
- Handler waliduje `sessionId`, flagi boolean, autoryzację użytkownika.
- `routineSessionService.getDetails`:
  - Pobiera sesję z `routine_sessions` (wraz z `routine` dla weryfikacji rodziny).
  - Jeśli `includeTasks`, pobiera `task_completions` + dane zadań (`routine_tasks`).
  - Jeśli `includePerformance`, pobiera rekord z `routine_performance_stats`.
  - Mapuje dane do DTO (łączy statusy zadań, łączy `best_time_beaten`).
- Handler ustawia `Cache-Control: private, max-age=15` dla szybkich kolejnych odczytów.

## 5. Względy bezpieczeństwa
- Użytkownik musi należeć do rodziny sesji; dziecko tylko własna sesja (sprawdzenie `child_profile_id`).
- Rodzic/admin ma dostęp do wszystkich dzieci w rodzinie.
- Ignoruj flagi `include*` jeśli rola nie ma uprawnień (np. `performance` tylko rodzic? – potwierdzić).
- Brak service role; rely on RLS.

## 6. Obsługa błędów
- `400 Bad Request`: niepoprawny UUID, flagi nie-boolean (np. `includeTasks=foo`).
- `401 Unauthorized`: brak tokena.
- `403 Forbidden`: dostęp do obcej sesji / dziecko innej rodziny.
- `404 Not Found`: sesja nie istnieje lub soft-deleted.
- `500 Internal Server Error`: błąd Supabase; log z `sessionId`.

## 7. Rozważania dotyczące wydajności
- Używaj pojedynczych zapytań z `select` + `eq` by ograniczyć round-trips.
- Przy dołączaniu zadań wykonaj `order` po `position` (indeks `task_completions_session_order_idx`).
- Cache wyników po stronie serwera (krótki TTL) aby przyspieszyć kolejne odczyty w UI.
- Rozważ lazy-load (klient może odpytać tasks/performance osobno) jeśli payload zbyt duży.

## 8. Etapy wdrożenia
1. Przygotuj schemat walidacji (UUID + boolean flags).
2. Zaimplementuj `routineSessionService.getDetails` (Supabase queries + mapowanie).
3. Stwórz mapper łączący `task_completions` z `routine_tasks` i fallback `pending`.
4. Dodaj handler GET w `route.ts`, który obsłuży zarówno listę (HEAD?), upewnij się, że współdzieli logikę autoryzacji.
5. Zaimplementuj obsługę błędów i logging.
6. Uzupełnij dokumentację OpenAPI + przypadki testowe (z/bez tasks, brak uprawnień).

# API Endpoint Implementation Plan: POST /sessions/{sessionId}/skip

## 1. Przegląd punktu końcowego
- Pozwala rodzicowi/adminowi pominąć lub wygasić sesję dziecka (`skipped` lub `expired`).
- Dokumentuje powód pominięcia i aktualizuje status bez finalizacji punktów.
- Integruje się z logiką sesji, zapobiegając dalszemu wykonywaniu zadań.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`.
- Struktura URL: `/api/v1/sessions/{sessionId}/skip` (`src/app/api/v1/sessions/[sessionId]/skip/route.ts`).
- Parametry ścieżki: `sessionId` (UUID, wymagany).
- Parametry zapytania: brak.
- Request body (`RoutineSessionSkipCommand`):
  ```json
  {
    "reason": "string",
    "status": "skipped"
  }
  ```
  - `status` wymagany (`skipped` lub `expired`).
  - `reason` opcjonalny (limit długości np. 500 znaków).
- Nagłówki: `Authorization: Bearer <Supabase JWT>`, `Content-Type: application/json`.

## 3. Szczegóły odpowiedzi
- Status sukcesu: `200 OK`.
- Struktura (`RoutineSessionSkipResultDto`):
  ```json
  {
    "message": "Session skipped"
  }
  ```
- Można rozszerzyć o aktualny status sesji dla przejrzystości.

## 4. Przepływ danych
- Handler waliduje `sessionId`, body i autoryzację (rola `parent`/`admin`).
- `routineSessionService.skip` w transakcji:
  - Pobiera sesję, weryfikuje status (`scheduled` lub `in_progress`).
  - Aktualizuje `routine_sessions.status`, `completion_reason`, `completed_at` (dla `expired` ustaw `auto_closed_at`), `updated_at`.
  - Opcjonalnie usuwa lub oznacza otwarte `task_completions` jako anulowane.
- Zwraca komunikat; brak zmian w punktach.

## 5. Względy bezpieczeństwa
- Dostęp ograniczony do rodziców/adminów; dziecko nie może pomijać.
- Potwierdź, że `sessionId` należy do rodziny (krzyżowe sprawdzenie).
- Rate limit (np. 20/min) utrudniający nadużycie.
- Loguj operacje (audit trail) z `profile_id` wypisującym akcję.

## 6. Obsługa błędów
- `400 Bad Request`: status inny niż dozwolony, pusta sesja, powód zbyt długi.
- `401 Unauthorized`: brak tokena.
- `403 Forbidden`: użytkownik bez roli rodzica/admina lub z innej rodziny.
- `404 Not Found`: sesja nie istnieje lub została usunięta.
- `409 Conflict`: sesja już zakończona (`completed`, `auto_closed`, `skipped`), równoległa aktualizacja.
- `500 Internal Server Error`: błędy Supabase/transakcji; log z kontekstem.

## 7. Rozważania dotyczące wydajności
- Operacja pojedyncza — ważna szybka transakcja (UPDATE + ewentualne kasowanie).
- Upewnij się, że blokada rekordu nie trwa długo (krótka transakcja).
- Pamiętaj o indeksie `routine_sessions_status_idx` (przy raportowaniu).

## 8. Etapy wdrożenia
1. Dodaj schemat walidacji body (enum status, limit długości reason).
2. Rozszerz `routineSessionService` o metodę `skip` z transakcją Supabase/RPC.
3. Zapewnij aktualizację stanu sesji oraz ewentualne czyszczenie `task_completions`.
4. Zaimplementuj handler POST, weryfikujący rolę i kontekst rodziny.
5. Dodaj logging (audit) i mapowanie błędów.
6. Zaktualizuj dokumentację OpenAPI + scenariusze testowe (skip przez rodzica, odmowa dziecku, ponowny skip).

# API Endpoint Implementation Plan: GET /profiles/me

## 1. Przegląd punktu końcowego
- Zwraca szczegóły profilu zalogowanego użytkownika (rodzica lub dziecka).
- Wspiera UI do konfiguracji konta i personalizacji doświadczenia.
- Bazuje na danych z tabeli `profiles` z uwzględnieniem locków PIN.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`.
- Struktura URL: `/api/v1/profiles/me` (`src/app/api/v1/profiles/me/route.ts`).
- Parametry: brak (profil identyfikowany przez kontekst uwierzytelnienia).
- Nagłówki: `Authorization: Bearer <Supabase JWT>` (mock – `x-debug-profile-id`, `x-debug-role`).

## 3. Szczegóły odpowiedzi
- Status sukcesu: `200 OK`.
- Struktura (`ProfileSelfDto`):
  ```json
  {
    "id": "uuid",
    "familyId": "uuid",
    "role": "parent",
    "displayName": "string",
    "email": "string",
    "avatarUrl": "string",
    "settings": {},
    "lastLoginAt": "ISO-8601",
    "createdAt": "ISO-8601",
    "pinLock": {
      "failedAttempts": 0,
      "lockExpiresAt": "ISO-8601"
    }
  }
  ```
- Jeśli profil nie istnieje → `404 Not Found`.

## 4. Przepływ danych
- Handler pobiera kontekst (mockowany) i Supabase client z RLS.
- Wywołuje `profiles` select po `id`, `deleted_at IS NULL`.
- Mapuje wynik do DTO (transformuje nazwy pól snake_case → camelCase, w tym `pin_lock`).
- Zwraca wynik; brak cache (dane użytkownika).

## 5. Względy bezpieczeństwa
- Waliduj obecność `profileId` w kontekście; brak → `401`.
- Upewnij się, że `deleted_at` jest `NULL`.
- Nie ujawniaj danych wrażliwych (PIN hash).
- Mockowane nagłówki powinny być wyłączone w produkcji (TODO).

## 6. Obsługa błędów
- `401 Unauthorized`: brak kontekstu.
- `404 Not Found`: profil nie odnaleziony.
- `500 Internal Server Error`: błąd Supabase; loguj kontekst.

## 7. Rozważania dotyczące wydajności
- Zapytanie single-row po PK (indeks).
- Ewentualne cache po stronie klienta; serwer bez cache.

## 8. Etapy wdrożenia
1. Utwórz helper `getAuthContext(req)` zwracający `profileId`, `familyId`, `role`.
2. Zaimplementuj `getProfileById` w serwisie `profilesService`.
3. Dodaj handler GET mapujący wynik do DTO i obsługujący błędy.
4. Zaktualizuj dokumentację i scenariusze testowe (profil istnieje / brak / brak auth).

# API Endpoint Implementation Plan: GET /families/current

## 1. Przegląd punktu końcowego
- Zwraca dane rodziny przypisanej do zalogowanego profilu.
- Służy jako źródło konfiguracji globalnej (nazwa, timezone, ustawienia onboarding).

## 2. Szczegóły żądania
- Metoda HTTP: `GET`.
- Struktura URL: `/api/v1/families/current` (`src/app/api/v1/families/current/route.ts`).
- Parametry: brak (wykorzystuje `familyId` z kontekstu).
- Nagłówki: `Authorization` (mock nagłówki debug).

## 3. Szczegóły odpowiedzi
- Status sukcesu: `200 OK`.
- Struktura (`FamilyDto`):
  ```json
  {
    "id": "uuid",
    "familyName": "string",
    "timezone": "Europe/Warsaw",
    "settings": {},
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  }
  ```
- Gdy rodzina nie istnieje → `404 Not Found`.

## 4. Przepływ danych
- Handler pobiera kontekst, weryfikuje `familyId`.
- Serwis `familiesService.getById` czyta rekord (z `deleted_at IS NULL`).
- Mapowanie do DTO (camelCase).
- Dodanie nagłówków `Cache-Control: private, max-age=30`.

## 5. Względy bezpieczeństwa
- `familyId` z kontekstu; brak → `404` lub `401`.
- Korzystaj z RLS Supabase; brak service role.

## 6. Obsługa błędów
- `401 Unauthorized`: brak kontekstu.
- `404 Not Found`: rodzina nie istnieje.
- `500 Internal Server Error`: błąd zapytania; loguj `familyId`.

## 7. Rozważania dotyczące wydajności
- Zapytanie po PK, szybkie; można dodać `ETag` (hash `updatedAt`).
- Krótki cache prywatny.

## 8. Etapy wdrożenia
1. Dodaj serwis `familiesService.getById`.
2. Zaimplementuj handler GET z mapowaniem DTO.
3. Dodaj obsługę `ETag` (opcjonalnie) i nagłówki cache.
4. Zaktualizuj dokumentację/testy (sukces, brak rodziny, brak auth).

# API Endpoint Implementation Plan: PATCH /families/{familyId}

## 1. Przegląd punktu końcowego
- Aktualizuje dane rodziny (nazwa, timezone, ustawienia onboarding).
- Stosuje walidację IANA timezone i soft-delete constraints.
- Pozwala rodzicowi/adminowi dostosować konfigurację globalną.

## 2. Szczegóły żądania
- Metoda HTTP: `PATCH`.
- Struktura URL: `/api/v1/families/{familyId}` (`src/app/api/v1/families/[familyId]/route.ts`).
- Parametry ścieżki: `familyId` (UUID, wymagany – musi równać się kontekstowemu `familyId`).
- Request body (`FamilyUpdateCommand`):
  ```json
  {
    "familyName": "string",
    "timezone": "Europe/Warsaw",
    "settings": { "onboarding": { "completedSteps": [] } }
  }
  ```
- Nagłówki: `Authorization`, opcjonalnie `If-Match` z `updatedAt` (do rozważenia).

## 3. Szczegóły odpowiedzi
- Status sukcesu: `200 OK`.
- Struktura (`FamilyDto` – po aktualizacji).
- W przypadku braku zmian – nadal `200` z aktualnym stanem.

## 4. Przepływ danych
- Handler waliduje `familyId` (UUID) i porównuje z kontekstem.
- Waliduje body (Zod: `familyName` min 1 znak, `timezone` zgodny z listą, `settings` jako JSON).
- Serwis `familiesService.update` wykonuje update poprzez Supabase:
  - Sprawdza istnienie (SELECT).
  - Weryfikuje `updated_at` jeśli przesłano `If-Match` (opcjonalne). W MVP – pomijamy, ale notujemy TODO.
  - Wykonuje `update` i zwraca zaktualizowany rekord.
- Handler mapuje wynik do DTO i zwraca.

## 5. Względy bezpieczeństwa
- Tylko role `parent`/`admin` – weryfikacja w kontekście (mock).
- Zabroń aktualizacji innej rodziny (403).
- Zapewnij, że `deleted_at IS NULL`.

## 6. Obsługa błędów
- `400 Bad Request`: walidacja danych (np. zły timezone).
- `401 Unauthorized`: brak kontekstu.
- `403 Forbidden`: `familyId` niezgodny lub rola nieuprawniona.
- `404 Not Found`: rodzina nie istnieje.
- `409 Conflict`: (opcjonalne) mismatch `If-Match`.
- `500 Internal Server Error`: błędy Supabase; loguj.

## 7. Rozważania dotyczące wydajności
- Pojedynczy update; minimalne obciążenie.
- Można rozważyć caching w przyszłości (inwalidacja po update).

## 8. Etapy wdrożenia
1. Stwórz schemat walidacji dla body (Zod + lista IANA – użyj biblioteki `@vvo/tzdb`? ewentualnie `Intl.supportedValuesOf` w runtime).
2. Utwórz serwis `familiesService.update` (SELECT + UPDATE + mapowanie).
3. Zaimplementuj handler PATCH z kontrolą roli i mapowaniem błędów.
4. Dodaj testy manualne i dokumentację (sukces, zły timezone, brak uprawnień).
