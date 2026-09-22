"""Importa il catalogo dei task dall'Excel ufficiale del PTR.

    py -3.11 scripts/import_catalogo.py [percorso.xlsx]

Legge `docs/sorgenti/PTR_B1.3_CH-47F.xlsx` (colonne ID, MODULE, CH, SUBJECT,
TASK TYPE, TASK DESCRIPTION, OPERATION PERFORMED) e genera:
- `src/dati/catalogo.json`  usato dall'applicazione;
- `database/catalogo.sql`   tabelle del catalogo per Supabase.
Va rieseguito solo se cambia l'edizione del documento.
"""

import json
import re
import sys
from collections import Counter, OrderedDict
from pathlib import Path

import openpyxl

RADICE = Path(__file__).resolve().parent.parent
SORGENTE = Path(sys.argv[1]) if len(sys.argv) > 1 else RADICE / "docs/sorgenti/PTR_B1.3_CH-47F.xlsx"
# ordine e codici del Compliance Report (4.1); MEL è previsto ma senza task per il CH-47F
TASK_TYPE = OrderedDict(
    [
        ("LOC", "Location Identification of system components"),
        ("FOT", "Functional / Operational Test"),
        ("SGH", "Servicing / Ground Handling"),
        ("R/I", "Removal / Installation"),
        ("MEL", "Minimum Equipment List items requiring maintenance procedure"),
        ("TS", "Troubleshooting"),
    ]
)
# moduli della norma AER(EP).P-66 (i successivi sono specifici AVES)
MODULI_P66 = {1, 2, 3, 4, 5, 6}


def pulisci(testo):
    return re.sub(r"\s+", " ", str(testo or "")).strip()


def codice_chapter(valore):
    return f"{valore:02d}" if isinstance(valore, int) else pulisci(valore)


def main():
    foglio = openpyxl.load_workbook(SORGENTE, read_only=True).active
    righe = list(foglio.iter_rows(values_only=True))
    intestazione = [pulisci(c).upper() for c in righe[0]]
    atteso = ["ID", "MODULE", "CH", "SUBJECT", "TASK TYPE", "TASK DESCRIPTION", "OPERATION PERFORMED"]
    assert intestazione[:7] == atteso, f"Intestazione inattesa: {intestazione}"

    task, soggetti, chapter = [], {}, OrderedDict()
    for r in righe[1:]:
        if r[0] is None:
            continue
        tipo = pulisci(r[4])
        assert tipo in TASK_TYPE, f"Task type sconosciuto: {tipo}"
        ch = codice_chapter(r[2])
        modulo = int(r[1])
        if ch in chapter:
            assert chapter[ch] == modulo, f"Chapter {ch} in più moduli"
        chapter[ch] = modulo
        soggetti.setdefault(ch, Counter())[pulisci(r[3])] += 1
        task.append(
            {
                "id": int(r[0]),
                "modulo": modulo,
                "chapter": ch,
                "subject": pulisci(r[3]),
                "tipo": tipo,
                "descrizione": pulisci(r[5]),
                "riferimenti": pulisci(r[6]),
            }
        )

    ids = [t["id"] for t in task]
    assert len(ids) == len(set(ids)), "ID duplicati"

    def titolo(ch):
        # alcune righe riportano il titolo con piccole varianti: si usa il più frequente
        return max(soggetti[ch].items(), key=lambda kv: (kv[1], len(kv[0])))[0]

    catalogo = {
        "documento": "T1 Military Type Training CH-47F Cat. B1.3 – Allegato 1, ed. 00.01 del 4 dicembre 2025 (Approved DAAA)",
        "aeromobile": "CH-47F",
        "motore": "55-L714A",
        "categoria": "B1.3",
        "taskType": [{"codice": c, "descrizione": d} for c, d in TASK_TYPE.items()],
        "moduli": [
            {"numero": m, "p66": m in MODULI_P66}
            for m in sorted(set(chapter.values()))
        ],
        "chapter": [{"codice": ch, "titolo": titolo(ch), "modulo": m} for ch, m in chapter.items()],
        "task": task,
    }
    (RADICE / "src/dati/catalogo.json").write_text(json.dumps(catalogo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    q = lambda s: "'" + str(s).replace("'", "''") + "'"
    sql = [
        "-- Generato da scripts/import_catalogo.py: non modificare a mano.",
        "-- Catalogo del Practical Training Record CH-47F B1.3 (Allegato 1, ed. 00.01).",
        "",
        "create table if not exists public.moduli (numero int primary key, p66 boolean not null);",
        "create table if not exists public.task_type (codice text primary key, descrizione text not null, ordine int not null);",
        "create table if not exists public.chapter (codice text primary key, titolo text not null, modulo int not null references public.moduli, ordine int not null);",
        "create table if not exists public.task (",
        "  id int primary key, chapter text not null references public.chapter, tipo text not null references public.task_type,",
        "  subject text not null, descrizione text not null, riferimenti text not null default '');",
        "",
        "-- upsert, mai truncate: le registrazioni fanno riferimento ai task",
        "insert into public.moduli values " + ", ".join(f"({m['numero']}, {str(m['p66']).lower()})" for m in catalogo["moduli"])
        + " on conflict (numero) do update set p66 = excluded.p66;",
        "insert into public.task_type values " + ", ".join(f"({q(t['codice'])}, {q(t['descrizione'])}, {i})" for i, t in enumerate(catalogo["taskType"]))
        + " on conflict (codice) do update set descrizione = excluded.descrizione, ordine = excluded.ordine;",
        "insert into public.chapter values",
        ",\n".join(f"  ({q(c['codice'])}, {q(c['titolo'])}, {c['modulo']}, {i})" for i, c in enumerate(catalogo["chapter"]))
        + "\non conflict (codice) do update set titolo = excluded.titolo, modulo = excluded.modulo, ordine = excluded.ordine;",
        "insert into public.task values",
        ",\n".join(
            f"  ({t['id']}, {q(t['chapter'])}, {q(t['tipo'])}, {q(t['subject'])}, {q(t['descrizione'])}, {q(t['riferimenti'])})" for t in task
        )
        + "\non conflict (id) do update set chapter = excluded.chapter, tipo = excluded.tipo, subject = excluded.subject,"
        + " descrizione = excluded.descrizione, riferimenti = excluded.riferimenti;",
        "",
    ]
    (RADICE / "database/catalogo.sql").write_text("\n".join(sql), encoding="utf-8")

    per_tipo = Counter(t["tipo"] for t in task)
    per_modulo = Counter(t["modulo"] for t in task)
    print(f"{len(task)} task, {len(chapter)} chapter, {len(per_modulo)} moduli")
    print("per task type:", dict(per_tipo))
    print("per modulo:", dict(sorted(per_modulo.items())))


if __name__ == "__main__":
    main()
