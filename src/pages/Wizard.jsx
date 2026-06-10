import { useEffect, useMemo, useState } from 'react'
import { calculateGroupTable } from '../logic/groupTable.js'
import { buildBracket } from '../logic/bracket.js'
import {
  fillGroupAtRandom,
  autoResolveTieIfNeeded,
  fillKnockoutRoundAtRandom,
  fillUpToPhase,
} from '../logic/randomFill.js'
import { Header } from '../components/Header.jsx'
import { MatchCapture } from '../components/MatchCapture.jsx'
import { GroupTable } from '../components/GroupTable.jsx'
import { GroupSummary } from '../components/GroupSummary.jsx'
import { TiebreakResolver } from '../components/TiebreakResolver.jsx'
import { GroupIndex } from '../components/GroupIndex.jsx'
import { ResetPhaseModal } from '../components/ResetPhaseModal.jsx'
import { StartOverModal } from '../components/StartOverModal.jsx'
import { RandomFillModal } from '../components/RandomFillModal.jsx'
import { FillUntilModal } from '../components/FillUntilModal.jsx'
import { BracketBridge } from '../components/BracketBridge.jsx'
import { BracketCapture } from '../components/BracketCapture.jsx'
import { BracketSection } from '../components/BracketSection.jsx'
import { RoundClosure } from '../components/RoundClosure.jsx'
import { Coronation } from '../components/Coronation.jsx'
import { ExportPanel } from '../components/ExportPanel.jsx'
import { ImportPanel } from '../components/ImportPanel.jsx'
import { ParticipantModal } from '../components/ParticipantModal.jsx'
import './Wizard.css'

const GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L']

// Orden lineal de captura del bracket.
// M103 (tercer lugar) va ANTES de M104 (final), como en el calendario
// real del Mundial. M103 tiene boton "Saltar" para quien no lo quiera
// llenar; si lo saltan, pasan directo a la final sin bloquear nada.
const BRACKET_LINEAR_ORDER = [
  'M73','M74','M75','M76','M77','M78','M79','M80',
  'M81','M82','M83','M84','M85','M86','M87','M88',  // R32
  'M89','M90','M91','M92','M93','M94','M95','M96',  // R16
  'M97','M98','M99','M100',                          // QF
  'M101','M102',                                     // SF
  'M103',                                            // Tercer lugar (opcional)
  'M104',                                            // Final
]

const BRACKET_ROUNDS = ['r32', 'r16', 'qf', 'sf', 'third', 'final']

// Rondas con pantalla de cierre y la ULTIMA llave de cada una. Al pasar de
// esa llave (en el flujo lineal) mostramos el cierre antes de avanzar.
const ROUND_LAST_MATCH = { M88: 'r32', M96: 'r16', M100: 'qf', M102: 'sf' }

// A donde lleva el boton "Continuar" de cada cierre (primera llave de la
// ronda siguiente en el orden lineal). El cierre de Semis lleva a M103
// (tercer lugar, opcional), igual que el flujo lineal.
const ROUND_CONTINUE_TO = { r32: 'M89', r16: 'M97', qf: 'M101', sf: 'M103' }

// Una ronda esta "cerrada" cuando todas sus llaves estan decididas.
function isRoundComplete(bracket, round) {
  const matches = bracket?.[round]
  if (!matches || matches.length === 0) return false
  return matches.every((m) => m.status === 'decided')
}

// Etiquetas de las rondas de knockout (para titulos del modal de relleno).
const KO_ROUND_LABELS = {
  r32: 'Ronda de 32',
  r16: 'Octavos',
  qf: 'Cuartos',
  sf: 'Semifinales',
  third: 'Tercer lugar',
  final: 'Final',
}

// IDs oficiales de cada ronda de knockout (para contar cuanto falta en el
// relleno "hasta una fase").
const KO_ROUND_IDS = {
  r32: ['M73','M74','M75','M76','M77','M78','M79','M80','M81','M82','M83','M84','M85','M86','M87','M88'],
  r16: ['M89','M90','M91','M92','M93','M94','M95','M96'],
  qf: ['M97','M98','M99','M100'],
  sf: ['M101','M102'],
  third: ['M103'],
  final: ['M104'],
}

// Una ronda esta LISTA para rellenarse cuando su ronda previa ya esta
// resuelta: en terminos del motor, ninguna de sus llaves esta 'pending'
// (todas tienen equipos asignados).
function isRoundReadyToFill(bracket, round) {
  const matches = bracket?.[round]
  if (!matches || matches.length === 0) return false
  return matches.every((m) => m.status !== 'pending')
}

// Cuantas llaves de la ronda se pueden rellenar AHORA (faltan marcador o
// penales). Las ya decididas no cuentan.
function countRoundFillable(bracket, round) {
  const matches = bracket?.[round] ?? []
  return matches.filter(
    (m) => m.status === 'awaiting-score' || m.status === 'tied-needs-pens',
  ).length
}

// ---------- Helpers de tabla / grupos ----------

function getResolvedGroupTable({ groupCode, tournament, teams, prediction }) {
  const table = calculateGroupTable({
    groupCode,
    predictions: prediction.groupMatches,
    tournament,
    teams,
  })
  const userOrder = prediction.groupTiebreaks?.[groupCode]
  if (!Array.isArray(userOrder) || userOrder.length !== 4) return table

  const mapped = userOrder
    .map((code, i) => {
      const row = table.find((r) => r.code === code)
      if (!row) return null
      return { ...row, position: i + 1 }
    })
    .filter(Boolean)

  return mapped.length === 4 ? mapped : table
}

function hasAnyTopThreeTie(table) {
  return table.slice(0, 3).some((r) => r.tied)
}

function hasUserTiebreak(prediction, groupCode) {
  const order = prediction.groupTiebreaks?.[groupCode]
  return Array.isArray(order) && order.length === 4
}

function needsTiebreak(table, prediction, groupCode) {
  return hasAnyTopThreeTie(table) && !hasUserTiebreak(prediction, groupCode)
}

function isMatchCaptured(score) {
  return score != null && Number.isFinite(score.hs) && Number.isFinite(score.as)
}

function countCapturedInGroup(groupCode, tournament, prediction) {
  const matches = tournament.groupMatches.filter((m) => m.group === groupCode)
  return matches.filter((m) => isMatchCaptured(prediction.groupMatches[m.id])).length
}

function findFirstUncaptured(tournament, prediction) {
  for (const groupCode of GROUP_LETTERS) {
    const matches = tournament.groupMatches.filter((m) => m.group === groupCode)
    for (let i = 0; i < matches.length; i++) {
      if (!isMatchCaptured(prediction.groupMatches[matches[i].id])) {
        return { groupCode, matchIndex: i }
      }
    }
  }
  return null
}

function isGroupsFullyComplete(tournament, prediction, teams) {
  for (const g of GROUP_LETTERS) {
    const matches = tournament.groupMatches.filter((m) => m.group === g)
    const allCaptured = matches.every((m) => isMatchCaptured(prediction.groupMatches[m.id]))
    if (!allCaptured) return false
    const table = getResolvedGroupTable({ groupCode: g, tournament, teams, prediction })
    if (needsTiebreak(table, prediction, g)) return false
  }
  return true
}

// ---------- Helpers de bracket ----------

function findMatchInBracket(bracket, matchId) {
  if (!bracket) return null
  for (const round of BRACKET_ROUNDS) {
    const m = bracket[round]?.find((x) => x.id === matchId)
    if (m) return m
  }
  return null
}

// Siguiente llave del bracket a capturar en orden lineal.
// M103 es opcional: si M104 ya esta decidido (el usuario salto M103), lo
// saltamos en el "to do" para no devolver al usuario a una llave que
// expresamente saltearon.
function findFirstBracketTodo(bracket) {
  if (!bracket) return null
  for (const matchId of BRACKET_LINEAR_ORDER) {
    const m = findMatchInBracket(bracket, matchId)
    if (!m) continue
    if (m.status === 'decided') continue
    if (m.status === 'pending') continue
    if (matchId === 'M103') {
      const final = findMatchInBracket(bracket, 'M104')
      if (final?.status === 'decided') continue
    }
    return matchId
  }
  return null
}

function countBracketDecided(bracket) {
  if (!bracket) return 0
  let n = 0
  for (const round of BRACKET_ROUNDS) {
    n += bracket[round].filter((m) => m.status === 'decided').length
  }
  return n
}

function countBracketUncaptured(bracket) {
  if (!bracket) return 0
  let n = 0
  for (const round of BRACKET_ROUNDS) {
    n += bracket[round].filter((m) => m.status !== 'decided').length
  }
  return n
}

// ---------- Componente ----------

export function Wizard({ dataset, predictionApi }) {
  const { teams, tournament, annexCOptions } = dataset
  const {
    prediction,
    setMeta,
    replacePrediction,
    setMatchScore,
    setGroupTiebreak,
    setKnockoutScore,
    setKnockoutPens,
    setChampion,
    applyRandomFill,
    resetFromPhase,
    resetAll,
    wipeEverything,
  } = predictionApi

  // ---- Memos foundationales ----

  const groupsComplete = useMemo(
    () => isGroupsFullyComplete(tournament, prediction, teams),
    [tournament, prediction, teams],
  )

  // El bracket solo se computa cuando los grupos estan totalmente listos.
  // Antes de eso, buildBracket daria muchas llaves "pending" y no tiene
  // sentido para el usuario.
  const bracket = useMemo(() => {
    if (!groupsComplete) return null
    return buildBracket({
      tournament,
      teams,
      annexCOptions,
      predictions: prediction,
    })
  }, [groupsComplete, tournament, teams, annexCOptions, prediction])

  // Tablas resueltas de los 12 grupos: util para BracketBridge.
  const allGroupTables = useMemo(() => {
    if (!groupsComplete) return null
    const tables = {}
    for (const g of GROUP_LETTERS) {
      tables[g] = getResolvedGroupTable({ groupCode: g, tournament, teams, prediction })
    }
    return tables
  }, [groupsComplete, tournament, teams, prediction])

  // Deteccion de "stale": llaves cuyo home/away guardado difiere del
  // computado por el motor (ej. el usuario edito una llave previa y eso
  // cambio quien avanza). NO borramos en cascada; solo marcamos.
  const staleMatches = useMemo(() => {
    if (!bracket) return []
    const result = []
    for (const round of BRACKET_ROUNDS) {
      for (const m of bracket[round]) {
        const stored = prediction.knockout[m.id]
        if (!stored || !stored.home || !stored.away) continue
        if (m.home == null || m.away == null) continue
        if (stored.home !== m.home || stored.away !== m.away) {
          result.push(m)
        }
      }
    }
    return result
  }, [bracket, prediction.knockout])

  // Sincronizamos bracket.champion -> prediction.champion para que se
  // persista. El motor es la verdad; nosotros solo lo escribimos al
  // estado serializable.
  useEffect(() => {
    if (!bracket) return
    const motorChampion = bracket.champion ?? null
    if (motorChampion !== (prediction.champion ?? null)) {
      setChampion(motorChampion)
    }
  }, [bracket, prediction.champion, setChampion])

  // ---- Vista inicial ----

  const [view, setView] = useState(() => {
    // 1) Cualquier partido de grupo sin capturar -> capturarlo.
    const firstGroupUncaptured = findFirstUncaptured(tournament, prediction)
    if (firstGroupUncaptured) {
      return {
        kind: 'match',
        group: firstGroupUncaptured.groupCode,
        matchIndex: firstGroupUncaptured.matchIndex,
      }
    }
    // 2) Algun grupo con empate sin resolver -> resolverlo.
    for (const g of GROUP_LETTERS) {
      const table = getResolvedGroupTable({ groupCode: g, tournament, teams, prediction })
      if (needsTiebreak(table, prediction, g)) {
        return { kind: 'tiebreak', group: g }
      }
    }
    // 3) Grupos listos. Bracket?
    const initialBracket = buildBracket({
      tournament, teams, annexCOptions, predictions: prediction,
    })
    const todo = findFirstBracketTodo(initialBracket)
    const anyBracketCapture = Object.keys(prediction.knockout ?? {}).length > 0
    if (todo === null) return { kind: 'index' }
    if (!anyBracketCapture) return { kind: 'bracket-bridge' }
    return { kind: 'bracket-capture', matchId: todo }
  })

  const [showResetPhase, setShowResetPhase] = useState(false)
  const [showStartOver, setShowStartOver] = useState(false)
  const [showParticipantModal, setShowParticipantModal] = useState(false)
  // fillModal:
  //   null
  //   { scope: 'group', group, count }
  //   { scope: 'all', count, groupCount, bracketCount }
  const [fillModal, setFillModal] = useState(null)
  // Chooser "Rellenar al azar — ¿hasta qué fase?" (boton global del indice).
  const [showFillUntil, setShowFillUntil] = useState(false)

  // ---- Memos derivados ----

  const currentGroup = view.group ?? null

  const currentGroupMatches = useMemo(() => {
    if (!currentGroup) return []
    return tournament.groupMatches.filter((m) => m.group === currentGroup)
  }, [tournament, currentGroup])

  const currentTable = useMemo(() => {
    if (!currentGroup) return null
    return getResolvedGroupTable({
      groupCode: currentGroup,
      tournament,
      teams,
      prediction,
    })
  }, [currentGroup, tournament, teams, prediction])

  const totalGroupMatches = tournament.groupMatches.length
  const capturedGroupMatches = useMemo(() => {
    return tournament.groupMatches.filter((m) =>
      isMatchCaptured(prediction.groupMatches[m.id]),
    ).length
  }, [tournament, prediction])

  const uncapturedInCurrentGroup = useMemo(() => {
    if (!currentGroup) return 0
    return currentGroupMatches.filter(
      (m) => !isMatchCaptured(prediction.groupMatches[m.id]),
    ).length
  }, [currentGroup, currentGroupMatches, prediction])

  const bracketDecidedCount = useMemo(() => countBracketDecided(bracket), [bracket])
  const bracketUncapturedCount = useMemo(
    () => countBracketUncaptured(bracket),
    [bracket],
  )

  const totalUncapturedGroups = totalGroupMatches - capturedGroupMatches

  // Partidos que faltan para tener la quiniela COMPLETA (informativo, para la
  // pantalla de export). Cuenta los partidos de grupo sin capturar + las
  // llaves eliminatorias sin decidir EXCLUYENDO el tercer lugar (M103), que
  // es opcional. Si los grupos aun no estan listos, el bracket no se puede
  // armar: faltan las 31 llaves obligatorias completas.
  const knockoutRemaining = useMemo(() => {
    if (!bracket) return 31 // M73..M104 menos M103 (opcional)
    let n = 0
    for (const round of ['r32', 'r16', 'qf', 'sf', 'final']) {
      n += bracket[round].filter((m) => m.status !== 'decided').length
    }
    return n
  }, [bracket])

  const missingCount = totalUncapturedGroups + knockoutRemaining

  // ---- Navegacion ----

  const goToMatch = (group, matchIndex) =>
    setView({ kind: 'match', group, matchIndex })

  const goToIndex = () => setView({ kind: 'index' })

  const goToGroupSummary = (group, origin = 'flow') =>
    setView({ kind: 'group-summary', group, origin })

  const goToTiebreak = (group) => setView({ kind: 'tiebreak', group })

  const goToBracketBridge = () => setView({ kind: 'bracket-bridge' })

  const goToBracketCapture = (matchId) =>
    setView({ kind: 'bracket-capture', matchId })

  const goToRoundClosure = (round, origin = 'flow') =>
    setView({ kind: 'round-closure', round, origin })

  const goToCoronation = () => setView({ kind: 'coronation' })

  const goToExport = () => setView({ kind: 'export' })

  const goToImport = () => setView({ kind: 'import' })

  // Importacion: ya validada y confirmada en ImportPanel. Reemplaza el estado
  // y lleva al usuario al indice para que vea la quiniela cargada.
  const handleImport = (incoming) => {
    replacePrediction(incoming)
    goToIndex()
  }

  // ---- Handlers de fase de grupos ----

  const handleNext = () => {
    if (view.kind !== 'match') return
    const nextIndex = view.matchIndex + 1
    if (nextIndex < 6) {
      goToMatch(view.group, nextIndex)
      return
    }
    if (needsTiebreak(currentTable, prediction, view.group)) {
      goToTiebreak(view.group)
    } else {
      goToGroupSummary(view.group, 'flow')
    }
  }

  const handlePrev = () => {
    if (view.kind !== 'match') return
    if (view.matchIndex > 0) {
      goToMatch(view.group, view.matchIndex - 1)
      return
    }
    const idx = GROUP_LETTERS.indexOf(view.group)
    if (idx > 0) goToMatch(GROUP_LETTERS[idx - 1], 5)
  }

  const handleContinueFromSummary = () => {
    const idx = GROUP_LETTERS.indexOf(view.group)
    if (idx < GROUP_LETTERS.length - 1) {
      goToMatch(GROUP_LETTERS[idx + 1], 0)
      return
    }
    // Ultimo grupo. Si grupos quedan TOTALMENTE listos vamos al puente
    // del bracket; si no, al indice (algun grupo seguramente esta con
    // empate sin resolver y el usuario lo vera ahi).
    if (isGroupsFullyComplete(tournament, prediction, teams)) {
      goToBracketBridge()
    } else {
      goToIndex()
    }
  }

  const handlePickGroup = (group) => {
    const matches = tournament.groupMatches.filter((m) => m.group === group)
    const firstUncapturedIdx = matches.findIndex(
      (m) => !isMatchCaptured(prediction.groupMatches[m.id]),
    )
    goToMatch(group, firstUncapturedIdx === -1 ? 0 : firstUncapturedIdx)
  }

  const handlePickGroupSummary = (group) => {
    goToGroupSummary(group, 'index')
  }

  // ---- Handlers de bracket ----

  const handleStartBracket = () => {
    const todo = findFirstBracketTodo(bracket)
    if (todo) goToBracketCapture(todo)
    else goToIndex()
  }

  const handleNextBracket = () => {
    if (view.kind !== 'bracket-capture') return
    const matchId = view.matchId
    const idx = BRACKET_LINEAR_ORDER.indexOf(matchId)

    // Final (M104): si la final esta resuelta y hay campeon, coronacion;
    // si no (empate sin penales, etc.), volvemos al indice sin inventar.
    if (matchId === 'M104') {
      if (bracket?.champion) goToCoronation()
      else goToIndex()
      return
    }

    // Cierre de ronda: si esta es la ultima llave de una ronda con cierre y
    // la ronda quedo completa (todas decididas), mostramos el cierre antes
    // de avanzar. Si quedo algun penal pendiente, seguimos el flujo lineal
    // normal y el usuario podra revisitar el cierre desde el indice.
    const closureRound = ROUND_LAST_MATCH[matchId]
    if (closureRound && isRoundComplete(bracket, closureRound)) {
      goToRoundClosure(closureRound, 'flow')
      return
    }

    // Avance lineal normal.
    if (idx < 0 || idx === BRACKET_LINEAR_ORDER.length - 1) {
      goToIndex()
      return
    }
    goToBracketCapture(BRACKET_LINEAR_ORDER[idx + 1])
  }

  // "Continuar" desde un cierre (flujo lineal): a la primera llave de la
  // ronda siguiente.
  const handleContinueFromClosure = (round) => {
    const nextMatch = ROUND_CONTINUE_TO[round]
    if (nextMatch) goToBracketCapture(nextMatch)
    else goToIndex()
  }

  const handlePrevBracket = () => {
    if (view.kind !== 'bracket-capture') return
    const idx = BRACKET_LINEAR_ORDER.indexOf(view.matchId)
    if (idx <= 0) return
    goToBracketCapture(BRACKET_LINEAR_ORDER[idx - 1])
  }

  // Saltar M103: pasa directo a M104 sin marcar nada.
  const handleSkipThird = () => goToBracketCapture('M104')

  const handleKnockoutScoreChange = (matchId, hs, as, home, away) => {
    setKnockoutScore(matchId, hs, as, home, away)
  }

  const handleKnockoutPensChange = (matchId, pHs, pAs) => {
    setKnockoutPens(matchId, pHs, pAs)
  }

  // ---- Random fill ----

  const requestFillCurrentGroup = () => {
    if (!currentGroup) return
    const count = uncapturedInCurrentGroup
    if (count === 0) return
    setFillModal({ scope: 'group', group: currentGroup, count })
  }

  // Opciones del chooser global "hasta qué fase rellenar". El conteo es
  // acumulado: cuantos partidos se rellenarian desde donde va el usuario hasta
  // completar esa fase (grupos pendientes + llaves no capturadas hasta ahi).
  const fillUntilOptions = useMemo(() => {
    const koPending = (ids) =>
      ids.filter((id) => {
        const ko = prediction.knockout?.[id]
        return !(ko && Number.isFinite(ko.hs) && Number.isFinite(ko.as))
      }).length

    const g = totalUncapturedGroups
    const r32 = koPending(KO_ROUND_IDS.r32)
    const r16 = koPending(KO_ROUND_IDS.r16)
    const qf = koPending(KO_ROUND_IDS.qf)
    const sf = koPending(KO_ROUND_IDS.sf)
    const third = koPending(KO_ROUND_IDS.third)
    const final = koPending(KO_ROUND_IDS.final)

    return [
      { target: 'groups', label: 'Solo la fase de grupos', count: g },
      { target: 'r32', label: 'Hasta la Ronda de 32', count: g + r32 },
      { target: 'r16', label: 'Hasta Octavos', count: g + r32 + r16 },
      { target: 'qf', label: 'Hasta Cuartos', count: g + r32 + r16 + qf },
      { target: 'sf', label: 'Hasta Semifinales', count: g + r32 + r16 + qf + sf },
      { target: 'third', label: 'Hasta el Tercer lugar', count: g + r32 + r16 + qf + sf + third },
      { target: 'final', label: 'Todo (hasta la final y el campeón)', count: g + r32 + r16 + qf + sf + third + final },
    ]
  }, [prediction, totalUncapturedGroups])

  // Abre el chooser global. Solo tiene sentido si hay algo pendiente.
  const requestFillUntil = () => {
    const total = fillUntilOptions[fillUntilOptions.length - 1].count
    if (total === 0) return
    setShowFillUntil(true)
  }

  // Ejecuta el relleno encadenado hasta la fase elegida, reutilizando
  // fillUpToPhase (que a su vez reutiliza la logica de grupos y rondas).
  const confirmFillUntil = (target) => {
    const { matchUpdates, tiebreakUpdates, knockoutUpdates, champion } =
      fillUpToPhase({
        tournament,
        teams,
        annexCOptions,
        predictions: prediction,
        target,
      })
    applyRandomFill({ matchUpdates, tiebreakUpdates, knockoutUpdates, champion })
    setShowFillUntil(false)
    goToIndex()
  }

  // Solo una ronda de knockout. Solo procede si la ronda esta lista (su
  // previa resuelta) y tiene llaves por rellenar.
  const requestFillRound = (round) => {
    if (!isRoundReadyToFill(bracket, round)) return
    const count = countRoundFillable(bracket, round)
    if (count === 0) return
    setFillModal({
      scope: 'round',
      round,
      roundLabel: KO_ROUND_LABELS[round],
      count,
    })
  }

  const confirmFill = () => {
    const fm = fillModal
    if (!fm) return

    if (fm.scope === 'group') {
      const matchUpdates = fillGroupAtRandom({
        groupCode: fm.group,
        tournament,
        predictions: prediction,
      })
      const preview = {
        ...prediction,
        groupMatches: { ...prediction.groupMatches, ...matchUpdates },
      }
      const order = autoResolveTieIfNeeded({
        groupCode: fm.group, tournament, teams, predictions: preview,
      })
      applyRandomFill({
        matchUpdates,
        tiebreakUpdates: order ? { [fm.group]: order } : {},
      })
      setFillModal(null)
      goToGroupSummary(fm.group, 'flow')
      return
    }

    // scope === 'round': rellenar SOLO una ronda de knockout.
    if (fm.scope === 'round') {
      const { knockoutUpdates, champion } = fillKnockoutRoundAtRandom({
        tournament,
        teams,
        annexCOptions,
        predictions: prediction,
        round: fm.round,
      })
      applyRandomFill({ knockoutUpdates, champion })
      setFillModal(null)
      goToIndex()
      return
    }
  }

  const cancelFill = () => setFillModal(null)

  // ---- Reset ----

  // "Borrar fase": reinicia una etapa concreta (conserva identidad).
  const handleResetPhase = (scope) => {
    setShowResetPhase(false)
    resetFromPhase(scope)
    // Si borramos desde grupos, volvemos al primer partido; si solo tocamos
    // parte de la eliminatoria, los grupos siguen intactos -> al indice.
    if (scope === 'groups') goToMatch('A', 0)
    else goToIndex()
  }

  // "Empezar de nuevo": reinicio grande, dos variantes.
  const handleStartOver = (kind) => {
    setShowStartOver(false)
    if (kind === 'wipe') {
      // Borra todo, incluida la identidad. App vuelve a la bienvenida
      // automaticamente (firstName queda vacio); no hace falta navegar.
      wipeEverything()
      return
    }
    // kind === 'blank': mi quiniela en blanco (conserva identidad).
    resetAll()
    goToMatch('A', 0)
  }

  // ---- Render ----

  return (
    <div className="wizard">
      <Header
        capturedMatches={capturedGroupMatches}
        totalMatches={totalGroupMatches}
        currentGroup={currentGroup}
        currentMatchIndex={view.kind === 'match' ? view.matchIndex : null}
        currentBracketMatchId={view.kind === 'bracket-capture' ? view.matchId : null}
        bracketDecidedCount={bracketDecidedCount}
        groupsComplete={groupsComplete}
        onShowIndex={goToIndex}
        onShowResetPhase={() => setShowResetPhase(true)}
        onShowStartOver={() => setShowStartOver(true)}
        onShowExport={goToExport}
        onShowImport={goToImport}
        onEditData={() => setShowParticipantModal(true)}
      />

      <main className="wizard-main">
        {view.kind === 'match' && (
          <MatchView
            group={view.group}
            matchIndex={view.matchIndex}
            matches={currentGroupMatches}
            table={currentTable}
            teams={teams}
            prediction={prediction}
            onScoreChange={setMatchScore}
            onPrev={handlePrev}
            onNext={handleNext}
            canGoPrev={!(view.group === 'A' && view.matchIndex === 0)}
            uncapturedInGroup={uncapturedInCurrentGroup}
            onRandomFillGroup={requestFillCurrentGroup}
          />
        )}

        {view.kind === 'group-summary' && (
          <GroupSummary
            group={view.group}
            table={currentTable}
            teams={teams}
            matches={currentGroupMatches}
            prediction={prediction}
            origin={view.origin ?? 'flow'}
            needsTiebreak={needsTiebreak(currentTable, prediction, view.group)}
            isLastGroup={view.group === GROUP_LETTERS[GROUP_LETTERS.length - 1]}
            onScoreChange={setMatchScore}
            onContinue={handleContinueFromSummary}
            onBackToIndex={goToIndex}
            onEditOneByOne={() => goToMatch(view.group, 0)}
            onGoToTiebreak={() => goToTiebreak(view.group)}
          />
        )}

        {view.kind === 'tiebreak' && (
          <TiebreakResolver
            group={view.group}
            table={currentTable}
            teams={teams}
            onSave={(order) => {
              setGroupTiebreak(view.group, order)
              goToGroupSummary(view.group, 'flow')
            }}
            onCancel={() => goToMatch(view.group, 5)}
          />
        )}

        {view.kind === 'bracket-bridge' && bracket && allGroupTables && (
          <BracketBridge
            bracket={bracket}
            allGroupTables={allGroupTables}
            teams={teams}
            onStart={handleStartBracket}
            onBackToIndex={goToIndex}
          />
        )}

        {view.kind === 'bracket-capture' && bracket && (
          <BracketCaptureView
            matchId={view.matchId}
            bracket={bracket}
            prediction={prediction}
            teams={teams}
            onScoreChange={handleKnockoutScoreChange}
            onPensChange={handleKnockoutPensChange}
            onPrev={handlePrevBracket}
            onNext={handleNextBracket}
            onSkipThird={handleSkipThird}
            canGoPrev={BRACKET_LINEAR_ORDER.indexOf(view.matchId) > 0}
          />
        )}

        {view.kind === 'round-closure' && bracket && (
          <RoundClosure
            round={view.round}
            bracket={bracket}
            teams={teams}
            origin={view.origin ?? 'flow'}
            onContinue={() => handleContinueFromClosure(view.round)}
            onBackToIndex={goToIndex}
          />
        )}

        {view.kind === 'coronation' && bracket && bracket.champion && (
          <Coronation
            bracket={bracket}
            teams={teams}
            prediction={prediction}
            missingCount={missingCount}
            onEditData={() => setShowParticipantModal(true)}
            onBackToIndex={goToIndex}
            onReview={goToIndex}
          />
        )}

        {view.kind === 'export' && (
          <ExportPanel
            prediction={prediction}
            missingCount={missingCount}
            onEditData={() => setShowParticipantModal(true)}
            onBackToIndex={goToIndex}
          />
        )}

        {view.kind === 'import' && (
          <ImportPanel
            dataset={dataset}
            onImport={handleImport}
            onBackToIndex={goToIndex}
          />
        )}

        {view.kind === 'index' && (
          <>
            <GroupIndex
              tournament={tournament}
              teams={teams}
              prediction={prediction}
              getResolvedTable={(g) =>
                getResolvedGroupTable({ groupCode: g, tournament, teams, prediction })
              }
              countCaptured={(g) => countCapturedInGroup(g, tournament, prediction)}
              hasUserTiebreak={(g) => hasUserTiebreak(prediction, g)}
              onPickGroup={handlePickGroup}
              onPickGroupSummary={handlePickGroupSummary}
              uncapturedCount={totalUncapturedGroups + (groupsComplete ? bracketUncapturedCount : 0)}
              onRandomFillUntil={requestFillUntil}
            />
            <BracketSection
              groupsComplete={groupsComplete}
              bracket={bracket}
              teams={teams}
              staleMatches={staleMatches}
              onPickMatch={goToBracketCapture}
              onGoToBridge={goToBracketBridge}
              onViewClosure={(round) => goToRoundClosure(round, 'index')}
              onViewCoronation={goToCoronation}
              onRequestFillRound={requestFillRound}
              onGoToGroups={() => {
                const first = findFirstUncaptured(tournament, prediction)
                if (first) goToMatch(first.groupCode, first.matchIndex)
                else goToIndex()
              }}
            />
          </>
        )}
      </main>

      {showResetPhase && (
        <ResetPhaseModal
          capturedMatches={capturedGroupMatches}
          tiebreaksCount={Object.keys(prediction.groupTiebreaks).length}
          knockoutCount={Object.keys(prediction.knockout ?? {}).length}
          onReset={handleResetPhase}
          onCancel={() => setShowResetPhase(false)}
        />
      )}

      {showStartOver && (
        <StartOverModal
          onStartOver={handleStartOver}
          onCancel={() => setShowStartOver(false)}
        />
      )}

      {showParticipantModal && (
        <ParticipantModal
          meta={prediction.meta}
          onSave={(meta) => {
            setMeta(meta)
            setShowParticipantModal(false)
          }}
          onCancel={() => setShowParticipantModal(false)}
        />
      )}

      {fillModal && (
        <RandomFillModal
          scope={fillModal.scope}
          group={fillModal.group}
          roundLabel={fillModal.roundLabel}
          count={fillModal.count}
          groupCount={fillModal.groupCount}
          bracketCount={fillModal.bracketCount}
          onConfirm={confirmFill}
          onCancel={cancelFill}
        />
      )}

      {showFillUntil && (
        <FillUntilModal
          options={fillUntilOptions}
          onConfirm={confirmFillUntil}
          onCancel={() => setShowFillUntil(false)}
        />
      )}
    </div>
  )
}

// MatchView (grupo) — auto-captura al ver + tabla live al lado.
function MatchView({
  group, matchIndex, matches, table, teams, prediction,
  onScoreChange, onPrev, onNext, canGoPrev,
  uncapturedInGroup, onRandomFillGroup,
}) {
  const match = matches[matchIndex]
  const storedScore = match ? prediction.groupMatches[match.id] : undefined
  const isAlreadyCaptured = isMatchCaptured(storedScore)

  useEffect(() => {
    if (!match) return
    if (!isAlreadyCaptured) {
      onScoreChange(match.id, 0, 0)
    }
  }, [match?.id, isAlreadyCaptured, onScoreChange])

  if (!match) return null

  const score = storedScore ?? { hs: 0, as: 0 }

  return (
    <div className="wizard-match-view">
      <MatchCapture
        match={match}
        score={score}
        teams={teams}
        groupCode={group}
        matchIndex={matchIndex}
        onScoreChange={(hs, as) => onScoreChange(match.id, hs, as)}
        onPrev={onPrev}
        onNext={onNext}
        canGoPrev={canGoPrev}
        uncapturedInGroup={uncapturedInGroup}
        onRandomFillGroup={onRandomFillGroup}
      />
      <GroupTable groupCode={group} table={table} teams={teams} />
    </div>
  )
}

// BracketCaptureView — auto-captura del score al ver (0-0) y deteccion de
// stale (stored.home/away != current). Penales NO se auto-capturan.
function BracketCaptureView({
  matchId, bracket, prediction, teams,
  onScoreChange, onPensChange,
  onPrev, onNext, onSkipThird, canGoPrev,
}) {
  const match = findMatchInBracket(bracket, matchId)
  const stored = prediction.knockout[matchId]
  const isAlreadyCaptured =
    stored != null && Number.isFinite(stored.hs) && Number.isFinite(stored.as)

  // Auto-captura del SCORE en 0-0 cuando vemos una llave que ya tiene
  // equipos asignados. Penales NO se auto-capturan.
  useEffect(() => {
    if (!match) return
    if (!match.home || !match.away) return
    if (isAlreadyCaptured) return
    onScoreChange(matchId, 0, 0, match.home, match.away)
  }, [matchId, match?.home, match?.away, isAlreadyCaptured, onScoreChange])

  if (!match) return null

  const isStale =
    stored && stored.home && stored.away && match.home && match.away &&
    (stored.home !== match.home || stored.away !== match.away)

  return (
    <BracketCapture
      match={match}
      stored={stored}
      teams={teams}
      isStale={!!isStale}
      onScoreChange={onScoreChange}
      onPensChange={onPensChange}
      onPrev={onPrev}
      onNext={onNext}
      onSkipThird={onSkipThird}
      canGoPrev={canGoPrev}
    />
  )
}
