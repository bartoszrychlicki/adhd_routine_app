export type RoutineType = "morning" | "afternoon" | "evening"

type TemplateTask = {
  id: string
  name: string
  description?: string
  points: number
  isOptional?: boolean
  expectedDurationSeconds?: number
}

type RoutineTemplateMap = Record<RoutineType, TemplateTask[]>

export const ROUTINE_TEMPLATES: RoutineTemplateMap = {
  morning: [
    {
      id: "wake-up",
      name: "Pobudka i ścielenie łóżka",
      description: "Wstań, rozciągnij się i przygotuj łóżko",
      points: 5,
      expectedDurationSeconds: 300,
    },
    {
      id: "wash-up",
      name: "Higiena poranna",
      description: "Mycie zębów i twarzy",
      points: 8,
      expectedDurationSeconds: 240,
    },
    {
      id: "breakfast",
      name: "Śniadanie",
      description: "Zjedz przygotowane śniadanie przy stole",
      points: 10,
      expectedDurationSeconds: 600,
    },
    {
      id: "pack-bag",
      name: "Sprawdź plecak",
      description: "Upewnij się, że wszystkie rzeczy są spakowane",
      points: 6,
      expectedDurationSeconds: 180,
    },
  ],
  afternoon: [
    {
      id: "homework",
      name: "Zadanie domowe",
      description: "Wykonaj zadania szkolne",
      points: 12,
      expectedDurationSeconds: 1800,
    },
    {
      id: "snack",
      name: "Podwieczorek",
      description: "Zjedz zdrową przekąskę",
      points: 4,
      expectedDurationSeconds: 300,
    },
    {
      id: "play",
      name: "Czas na zabawę",
      description: "Wybierz ulubioną aktywność na 20 minut",
      points: 5,
      expectedDurationSeconds: 1200,
      isOptional: true,
    },
    {
      id: "tidy-room",
      name: "Porządkowanie pokoju",
      description: "Ułóż zabawki i uporządkuj biurko",
      points: 6,
      expectedDurationSeconds: 420,
    },
  ],
  evening: [
    {
      id: "bath",
      name: "Wieczorna higiena",
      description: "Prysznic lub kąpiel i mycie zębów",
      points: 8,
      expectedDurationSeconds: 900,
    },
    {
      id: "prepare-clothes",
      name: "Przygotuj ubrania na jutro",
      description: "Wybierz strój i odłóż w jedno miejsce",
      points: 5,
      expectedDurationSeconds: 240,
    },
    {
      id: "reading",
      name: "Czytanie przed snem",
      description: "Przeczytaj fragment książki lub posłuchaj audiobooka",
      points: 7,
      expectedDurationSeconds: 600,
      isOptional: true,
    },
    {
      id: "lights-out",
      name: "Gaszenie świateł",
      description: "Zgaś światło i połóż się spać o ustalonej godzinie",
      points: 6,
      expectedDurationSeconds: 60,
    },
  ],
}

export const ROUTINE_DEFAULTS: Record<RoutineType, { start: string; end: string; autoClose: number; name: string }> = {
  morning: { start: "07:00", end: "08:00", autoClose: 30, name: "Poranna rutyna" },
  afternoon: { start: "15:00", end: "17:00", autoClose: 45, name: "Popołudniowa rutyna" },
  evening: { start: "19:00", end: "20:30", autoClose: 30, name: "Wieczorna rutyna" },
}

export const ROUTINE_TYPES: RoutineType[] = ["morning", "afternoon", "evening"]
