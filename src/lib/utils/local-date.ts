// Date "di calendario" nel fuso del dispositivo, in formato AAAA-MM-GG.
// toISOString() converte in UTC: tra mezzanotte e le 2 (ora italiana) restituisce il giorno prima,
// e una data trascinata sul diagramma può slittare di un giorno. Qui si usa sempre l'ora locale.

export const localIso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export const todayIso = (): string => localIso(new Date())
