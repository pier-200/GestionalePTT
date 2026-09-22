"""Importa il programma teorico (MTT) dall'Excel ufficiale.

    py -3.11 scripts/import_programma_mtt.py [docs/sorgenti/MTT_B1.3_CH-47F.xlsx] [id-programma]

Genera `src/dati/programmi/<id>.json`: moduli e **materie**, cioè i gruppi di voci che
condividono gli stessi "Tuition Min." del programma (nell'Excel il valore compare sulla prima
riga del gruppo e le righe successive lo ereditano). Ogni materia è l'unità di lezione:
ha una durata in minuti, un titolo e i chapter che copre.
"""

import json
import re
import sys
from pathlib import Path

import openpyxl

RADICE = Path(__file__).resolve().parent.parent
SORGENTE = Path(sys.argv[1]) if len(sys.argv) > 1 else RADICE / "docs/sorgenti/MTT_B1.3_CH-47F.xlsx"
ID = sys.argv[2] if len(sys.argv) > 2 else "mtt-ch47f-b13"


def pulisci(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def codice_chapter(v):
    return f"{v:02d}" if isinstance(v, int) else pulisci(v)


def minuti(v):
    """Nel file i totali di modulo oltre le mille unità sono scritti come 3.12 invece di 3120."""
    if isinstance(v, float) and not v.is_integer():
        return round(v * 1000)
    return int(v)


def main():
    foglio = openpyxl.load_workbook(SORGENTE, read_only=True).active
    righe = [[c for c in r] for r in foglio.iter_rows(values_only=True)]
    intestazione = [pulisci(c).upper() for c in righe[0][:5]]
    assert intestazione == ["ITEM", "CH.", "SUBJECT", "LEVEL", "TUITION MIN."], f"Intestazione inattesa: {intestazione}"

    moduli, materie, attesa = [], [], []
    modulo = None
    for r in righe[1:]:
        prima = pulisci(r[0])
        if prima.upper().startswith("TOTALE"):
            continue
        if prima.lower().startswith("module"):
            modulo = int(re.search(r"\d+", prima).group())
            moduli.append({"numero": modulo, "titolo": pulisci(r[2]).rstrip(":"), "minutiDichiarati": minuti(r[4]) if r[4] is not None else None})
            assert not attesa, f"Voci senza durata rimaste in sospeso prima del modulo {modulo}"
            continue
        if r[0] is None or modulo is None:
            continue
        voce = {
            "item": int(r[0]),
            "chapter": codice_chapter(r[1]),
            "subject": pulisci(r[2]),
            "livello": pulisci(r[3]),
        }
        if r[4] is not None:  # la durata apre una nuova materia, che assorbe le voci rimaste in attesa
            materie.append({"id": f"m{len(materie) + 1:03d}", "modulo": modulo, "minuti": minuti(r[4]), "titolo": (attesa[0] if attesa else voce)["subject"], "voci": [*attesa, voce]})
            attesa = []
        elif materie and materie[-1]["modulo"] == modulo:
            materie[-1]["voci"].append(voce)  # voce senza durata: fa parte della materia precedente
        else:
            attesa.append(voce)  # a inizio modulo: aspetta la prima durata (voci "coperte altrove", livello -)

    for m in moduli:
        m["minuti"] = sum(x["minuti"] for x in materie if x["modulo"] == m["numero"])
        if m["minutiDichiarati"] not in (None, m["minuti"]):
            print(f"  ATTENZIONE modulo {m['numero']}: dichiarati {m['minutiDichiarati']} min, calcolati {m['minuti']} min")
        del m["minutiDichiarati"]
    for materia in materie:
        materia["chapters"] = [v["chapter"] for v in materia["voci"]]

    programma = {
        "id": ID,
        "tipo": "teorico",
        "nome": "MTT CH-47F Cat. B1.3",
        "documento": "T1 Military Type Training CH-47F Cat. B1.3 – programma teorico (Cat B1.3)",
        "aeromobile": "CH-47F",
        "categoria": "B1.3",
        "moduli": moduli,
        "materie": materie,
    }
    (RADICE / "src/dati/programmi").mkdir(parents=True, exist_ok=True)
    (RADICE / f"src/dati/programmi/{ID}.json").write_text(json.dumps(programma, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    totale = sum(m["minuti"] for m in moduli)
    print(f"{len(materie)} materie, {len(moduli)} moduli, {sum(len(m['voci']) for m in materie)} voci, {totale} minuti ({totale / 60:g} ore)")
    for m in moduli:
        print(f"  modulo {m['numero']}: {m['minuti'] / 60:g} h – {m['titolo'][:50]}")


if __name__ == "__main__":
    main()
