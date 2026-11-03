"""Builds a small text PDF (no dependencies) from handbook.txt, one PDF page per ----PAGE---- block."""
import textwrap


def build_pdf(page_texts: list[str]) -> bytes:
    objects: list[str] = []  # 1-based object bodies

    def add(body: str) -> int:
        objects.append(body)
        return len(objects)

    catalog = add("")  # filled in below
    pages_obj = add("")
    font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    page_ids = []
    for text in page_texts:
        lines = []
        for paragraph in text.strip().split("\n"):
            lines.extend(textwrap.wrap(paragraph, 95) or [""])
        escaped = [l.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for l in lines]
        stream = "BT /F1 10 Tf 13 TL 40 800 Td\n" + "\n".join(f"({l}) '" for l in escaped) + "\nET"
        content = add(f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream")
        page_ids.append(
            add(
                f"<< /Type /Page /Parent {pages_obj} 0 R /MediaBox [0 0 595 842] "
                f"/Contents {content} 0 R /Resources << /Font << /F1 {font} 0 R >> >> >>"
            )
        )

    objects[catalog - 1] = f"<< /Type /Catalog /Pages {pages_obj} 0 R >>"
    kids = " ".join(f"{i} 0 R" for i in page_ids)
    objects[pages_obj - 1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>"

    out = "%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out.encode("latin-1")))
        out += f"{number} 0 obj\n{body}\nendobj\n"
    xref = len(out.encode("latin-1"))
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    out += "".join(f"{o:010d} 00000 n \n" for o in offsets)
    out += f"trailer\n<< /Size {len(objects) + 1} /Root {catalog} 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    return out.encode("latin-1")


def handbook_pdf(path: str = "eval/handbook.txt") -> bytes:
    with open(path, encoding="utf-8") as f:
        pages = f.read().split("----PAGE----")
    return build_pdf(pages)


if __name__ == "__main__":
    with open("handbook.pdf", "wb") as f:
        f.write(handbook_pdf())
    print("wrote handbook.pdf")
