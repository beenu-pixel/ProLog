# Efekty dźwiękowe

Wrzuć tutaj pliki `.mp3` o nazwach odpowiadających zdarzeniom z
[`src/lib/sound.ts`](../../src/lib/sound.ts) (`SoundName`). Helper `playSound`
ładuje plik spod `/sounds/<name>.mp3`; brak pliku jest cicho ignorowany.

Oczekiwane pliki:

| Plik | Kiedy gra |
|------|-----------|
| `theme-toggle.mp3` | przełączenie trybu jasny/ciemny |
| `entry-new.mp3` | rozpoczęcie tworzenia wpisu (przycisk „+") |
| `entry-save.mp3` | zapis wpisu (nowy lub edycja) |
| `entry-delete.mp3` | usunięcie wpisu |
| `dictate-start.mp3` | start dyktowania głosowego |
| `dictate-stop.mp3` | zatrzymanie dyktowania głosowego |

Dźwięki generujemy osobno (np. w ElevenLabs Studio) i podmieniamy nazwy na te
z tabeli.
