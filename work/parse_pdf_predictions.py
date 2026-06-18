import csv
import json
import re
import sys
from pathlib import Path

import pdfplumber

PDF_PATH = Path("/Users/joham/Downloads/POLLA MUNDIAL 26 ESTRATEGIAS.pdf")
CSV_PATH = Path("public/mundial2026_matches_completo.csv")

HEADER_RANGES = [(0, 150), (150, 270), (270, 390), (390, 520)]

PARTICIPANT_MAP = {
    "PATRICIA ÁRIAS": "p1",
    "YAMILE ROJAS": "p2",
    "CLAUDIA GÓMEZ": "p3",
    "JOHN ALVARADO": "p4",
    "MARLEN SOLANO": "p5",
    "JOSELIN CUBILLOS": "p6",
    "SANTIAGO CUBILLOS": "p7",
    "CAROLINA CUBILLOS": "p8",
    "VICTOR SOLANO": "p9",
    "DIEGO CASTAÑEDA": "p10",
    "ALEXANDER MUNAR": "p11",
    "ALEXANDER MUNEVAR": "p11",
    "WILIAM RAMÍREZ": "p12",
    "SORAIDA ORDOÑEZ": "p13",
    "IDALY - PEDRO": "p14",
    "DANIEL": "p15",
    "LILIANA MORENO": "p16",
    "SANTIAGO URIBE": "p17",
    "SEBASTIÁN URIBE": "p18",
    "CLARA HERNÁNDEZ": "p19",
    "JOHAM BOHÓRQUEZ": "p20",
}


def normalize_name(name):
    name = re.sub(r"\s+", " ", name).strip()
    return re.sub(r"\s*\([^)]*\)", "", name).strip()


def load_group_schedule():
    rows = []
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            if row["stage"] != "Group Stage":
                continue
            rows.append(row)
    return sorted(rows, key=lambda row: (row["group"], int(row["match_number"])))


def group_score_words(words, first_window, second_window):
    score_words = []
    for word in words:
        text = word["text"]
        if not re.fullmatch(r"\d+", text):
            continue
        x0 = word["x0"]
        is_home_score = first_window[0] <= x0 <= first_window[1]
        is_away_score = second_window[0] <= x0 <= second_window[1]
        if is_home_score or is_away_score:
            score_words.append(
                {
                    "top": word["top"],
                    "x0": x0,
                    "text": text,
                    "side": "home" if is_home_score else "away",
                }
            )

    rows = []
    for word in sorted(score_words, key=lambda item: (item["top"], item["x0"])):
        if not rows or abs(rows[-1]["top"] - word["top"]) > 1.4:
            rows.append({"top": word["top"], "words": [word]})
        else:
            rows[-1]["words"].append(word)

    score_pairs = []
    for row in rows:
        sides = {word["side"]: word for word in row["words"]}
        if "home" in sides and "away" in sides:
            score_pairs.append(
                {
                    "homeScore": int(sides["home"]["text"]),
                    "awayScore": int(sides["away"]["text"]),
                }
            )
    return score_pairs


def detect_score_windows(words):
    numeric_xs = sorted(
        round(word["x0"], 1)
        for word in words
        if word["top"] > 118 and re.fullmatch(r"\d+", word["text"])
    )
    clusters = []
    for x in numeric_xs:
        if not clusters or abs(x - clusters[-1][-1]) > 2:
            clusters.append([x])
        else:
            clusters[-1].append(x)

    centers = [sum(cluster) / len(cluster) for cluster in clusters if len(cluster) >= 10]
    windows = []
    for index in range(0, len(centers) - 1, 2):
        home_center = centers[index]
        away_center = centers[index + 1]
        windows.append(((home_center - 3, home_center + 3), (away_center - 3, away_center + 3)))
    return windows


def extract_pdf_predictions():
    schedule = load_group_schedule()
    entries = {}
    diagnostics = {"participants": [], "counts": [], "skippedColumns": []}

    with pdfplumber.open(PDF_PATH) as pdf:
        for page_index, page in enumerate(pdf.pages):
            words = page.extract_words(x_tolerance=1, y_tolerance=3)
            page_score_windows = detect_score_windows(words)

            for column_index, (x0, x1) in enumerate(HEADER_RANGES):
                name_words = [
                    word
                    for word in words
                    if 99 <= word["top"] <= 114 and x0 <= word["x0"] < x1
                ]
                name = normalize_name(" ".join(word["text"] for word in name_words))
                participant_id = PARTICIPANT_MAP.get(name)
                diagnostics["participants"].append(
                    {
                        "page": page_index + 1,
                        "column": column_index + 1,
                        "name": name,
                        "participantId": participant_id,
                    }
                )

                if not participant_id:
                    diagnostics["skippedColumns"].append(
                        {"page": page_index + 1, "column": column_index + 1, "name": name}
                    )
                    continue

                if column_index >= len(page_score_windows):
                    diagnostics["skippedColumns"].append(
                        {
                            "page": page_index + 1,
                            "column": column_index + 1,
                            "name": name,
                            "reason": "No score columns detected",
                        }
                    )
                    continue

                page_score_words = [word for word in words if word["top"] > 118]
                score_pairs = group_score_words(page_score_words, *page_score_windows[column_index])
                predictions = {
                    str(match["match_number"]): score
                    for match, score in zip(schedule, score_pairs)
                }
                entries[participant_id] = {
                    "matchPredictions": predictions,
                    "tieBreakOrders": {},
                    "submittedAt": "",
                    "complete": False,
                    "finalResults": {},
                }
                diagnostics["counts"].append(
                    {
                        "participantId": participant_id,
                        "name": name,
                        "scores": len(score_pairs),
                        "predictions": len(predictions),
                    }
                )

    return {"entries": entries, "diagnostics": diagnostics}


if __name__ == "__main__":
    result = extract_pdf_predictions()
    if "--write-public" in sys.argv:
        output_path = Path("public/first_round_predictions.json")
        output_path.write_text(json.dumps(result["entries"], ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Wrote {output_path}")
    print(json.dumps(result, ensure_ascii=False, indent=2))
