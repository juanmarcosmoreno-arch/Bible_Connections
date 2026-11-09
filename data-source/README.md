# data-source — datos de origen y licencias

Estos archivos se incluyen **sin modificar** y son la única entrada del proceso de datos
(`npm run data`). Sus licencias son independientes de la licencia MIT del código.

| Archivo | Contenido | Licencia | Procedencia |
|---|---|---|---|
| `cross_references.txt` | 344.799 referencias cruzadas con votos (`From Verse`, `To Verse`, `Votes`). Encabezado: `#www.openbible.info CC-BY 2026-11-02` | **Creative Commons Attribution 4.0 (CC BY 4.0)** | [OpenBible.info — Bible Cross References](https://www.openbible.info/labs/cross-references/) |
| `texts/spaRV1909/spaRV1909_vpl.txt` | Santa Biblia — Reina-Valera 1909 (texto por versículo) | **Dominio público** (ver `spaRV1909_about.htm`) | [eBible.org spaRV1909](https://ebible.org/find/details.php?id=spaRV1909) |
| `texts/eng-web/eng-web_vpl.txt` | World English Bible, edición estable 2020 | **Dominio público**. "World English Bible" es marca de eBible.org: si se modifica el texto no debe usarse ese nombre (ver `eng-web_about.htm`). Aquí no se modifica. | [eBible.org eng-web](https://ebible.org/find/details.php?id=eng-web) |

## Atribución requerida (CC BY 4.0)

> Cross-reference data from OpenBible.info (https://www.openbible.info/labs/cross-references/),
> licensed under the Creative Commons Attribution 4.0 International License
> (https://creativecommons.org/licenses/by/4.0/).

Según OpenBible.info, los datos provienen principalmente del *Treasury of Scripture Knowledge*
(dominio público) y los votos iniciales de su *Topical Bible* y *Twitter Bible Search*.
Bible Connections transforma el archivo a un formato binario y calcula estadísticas, sin
eliminar, inventar ni alterar referencias (ver `public/data/import-report.json`).

## Archivos derivados

- `../src/data/versification.json`: tabla de capítulos y versículos de la **King James Version
  (1769)**, derivada de eBible.org `eng-kjv2006` (dominio público fuera del Reino Unido) con
  `scripts/derive-versification.ts`; incluye el SHA-256 del archivo fuente. Se verificó que
  coincide versículo a versículo con la RV1909 incluida aquí.
- `texts/spaRV1909/alignment.json`: correspondencia entre la numeración de la RV1909 y la de la
  KJV en 20 capítulos donde difieren (p. ej. Números 13, Job 39–41, Jonás 2). Generada con
  `scripts/align-translation.ts` comparando los números Strong de ambas ediciones USFM de
  eBible.org; revisada manualmente. `alignment-manual.json` agrega 2 casos verificados a mano.
- `texts/eng-web/alignment.json`: la WEB imprime la doxología de Romanos (KJV 16:25-27) en
  14:24-26; se registra esa correspondencia.
