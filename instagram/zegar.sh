#!/usr/bin/env bash
# Tryb zegar: jeden przebieg workflow czeka do godziny slotu z harmonogram.json i publikuje dokładnie o czasie,
# potem czeka na następny slot. Przed każdym slotem pobiera świeże main (nowe wydania) i stan z gałęzi instagram.
# Gdy do następnego slotu jest dalej niż pozwala limit czasu joba, uruchamia swojego następcę (workflow_dispatch)
# i kończy się. Bez stanu z gałęzi instagram nigdy nie publikuje (brak pliku ≠ pierwsze uruchomienie).
# Wymaga: STAN_DIR, GH_TOKEN, GITHUB_REPOSITORY oraz zmiennych publikuj.mjs (IG_TOKEN, IG_TRYB=slot …).
set -uo pipefail
BUDZET_S=$(( ${ZEGAR_BUDZET_MIN:-320} * 60 ))
START=$(date +%s)
ostatni=""
proby=0

log() { echo "[$(TZ=Europe/Warsaw date '+%H:%M:%S')] $*"; }

swiezy_main() { git fetch -q --depth 1 origin main && git reset -q --hard FETCH_HEAD; }

pobierz_stan() {
  rm -rf "$STAN_DIR" && mkdir -p "$STAN_DIR" && cd "$STAN_DIR" || return 1
  git init -q -b instagram
  git config user.name "github-actions[bot]"
  git config user.email "41898333+github-actions[bot]@users.noreply.github.com"
  git remote add origin "${ZEGAR_REMOTE:-https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"
  local ok=0
  git fetch -q --depth 1 origin instagram && git checkout -q FETCH_HEAD -- opublikowane.json && ok=1
  cd - >/dev/null
  [ "$ok" = 1 ] && [ -s "$STAN_DIR/opublikowane.json" ]
}

nastepca() {
  for i in 1 2 3; do
    if gh api -X POST "repos/${GITHUB_REPOSITORY}/actions/workflows/instagram.yml/dispatches" \
         -f ref=main -f 'inputs[tryb]=zegar' >/dev/null; then
      log "Uruchomiono następcę (tryb zegar)."; echo "Zegar: przekazano następcy." >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; return 0
    fi
    sleep 20
  done
  echo "::error::Nie udało się uruchomić następcy zegara; zostaje cron co 15 min."
  return 1
}

while :; do
  if (( $(date +%s) - START > BUDZET_S )); then nastepca; exit 0; fi
  if ! swiezy_main; then log "Nie udało się pobrać main, ponowię za 60 s."; sleep 60; continue; fi
  if ! pobierz_stan; then log "Brak stanu z gałęzi instagram, ponowię za 60 s (bez stanu nie publikuję)."; sleep 60; continue; fi
  wynik=$(node instagram/slot.mjs nastepny "$STAN_DIR/opublikowane.json")
  if [ -z "$wynik" ]; then log "Na dziś wszystkie sloty zrobione albo minęły."; exit 0; fi
  read -r klucz sek <<<"$wynik"
  zostalo=$(( START + BUDZET_S - $(date +%s) ))
  if (( sek > zostalo )); then log "Następny slot ${klucz} za ${sek} s, poza limitem tego joba."; nastepca; exit 0; fi
  if (( sek > 0 )); then
    log "Czekam ${sek} s na slot ${klucz}."
    sleep $(( sek + 2 ))
    continue   # świeże main i stan tuż przed publikacją
  fi
  if [ "$klucz" = "$ostatni" ]; then
    proby=$(( proby + 1 ))
    log "Slot ${klucz} nadal otwarty po próbie ${proby}, ponowię za 120 s."
    sleep 120
    swiezy_main && pobierz_stan || continue
  else
    ostatni="$klucz"; proby=0
  fi
  log "Publikuję slot ${klucz}."
  node instagram/publikuj.mjs || echo "::warning::Publikacja slotu ${klucz} nieudana (próba $(( proby + 1 )))."
done
