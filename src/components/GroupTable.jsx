// Tabla del grupo. Muestra las 4 filas en el orden ya resuelto (calculado
// por el motor + override del usuario si lo hay). Las posiciones 1 y 2
// quedan resaltadas en verde como "clasifican".
//
// Modo: por defecto la tabla muestra columnas reducidas en movil y todas
// en desktop (mismo comportamiento del prototipo). Si pasamos fullColumns,
// muestra todas SIEMPRE (util en GroupSummary).

export function GroupTable({ groupCode, table, teams, fullColumns = false }) {
  // Helper para que cada columna numerica decida si se esconde en movil.
  const numCol = (extra = false) => {
    // `extra` = es una de las columnas que normalmente se ocultan en movil.
    if (fullColumns) return 'col-num'
    return extra ? 'col-num col-desktop' : 'col-num'
  }

  return (
    <section className="proto-table-section" aria-labelledby={`table-${groupCode}-title`}>
      <header className="proto-table-header">
        <h2 id={`table-${groupCode}-title`} className="proto-table-title">
          Tabla del Grupo {groupCode}
        </h2>
        <p className="proto-table-sub">Los 2 primeros avanzan</p>
      </header>

      <table className="proto-table">
        <thead>
          <tr>
            <th scope="col" className="col-pos">#</th>
            <th scope="col" className="col-team">Equipo</th>
            <th scope="col" className={numCol(true)}>PJ</th>
            <th scope="col" className={numCol(true)}>G</th>
            <th scope="col" className={numCol(true)}>E</th>
            <th scope="col" className={numCol(true)}>P</th>
            <th scope="col" className={numCol(true)}>GF</th>
            <th scope="col" className={numCol(true)}>GC</th>
            <th scope="col" className="col-num">DG</th>
            <th scope="col" className="col-num col-strong">Pts</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row) => {
            const team = teams[row.code]
            const classifies = row.position <= 2
            return (
              <tr key={row.code} className={classifies ? 'is-qualifies' : ''}>
                <td className="col-pos">
                  <span className="proto-pos">{row.position}</span>
                </td>
                <td className="col-team">
                  <div className="proto-team-row">
                    <span className="proto-team-flag-sm" aria-hidden="true">{team.flag}</span>
                    <span className="proto-team-row-name">{team.name}</span>
                    {classifies && !row.tied && (
                      <span
                        className="proto-qualifies-tag"
                        title="Clasifica"
                        aria-label="Clasifica"
                      >✓</span>
                    )}
                    {row.tied && (
                      <span
                        className="proto-tied-tag"
                        title="Empate exacto con otro(s) equipo(s)"
                        aria-label="Empate por resolver"
                      >Empate</span>
                    )}
                  </div>
                </td>
                <td className={numCol(true)}>{row.played}</td>
                <td className={numCol(true)}>{row.wins}</td>
                <td className={numCol(true)}>{row.draws}</td>
                <td className={numCol(true)}>{row.losses}</td>
                <td className={numCol(true)}>{row.goalsFor}</td>
                <td className={numCol(true)}>{row.goalsAgainst}</td>
                <td className="col-num">
                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                </td>
                <td className="col-num col-strong">{row.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
