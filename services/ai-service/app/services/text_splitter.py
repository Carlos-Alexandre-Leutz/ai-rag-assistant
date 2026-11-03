import re
from typing import List, Tuple

# Chunks shorter than this are page numbers, headers or noise.
MIN_CHUNK_CHARS = 20

_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
_PARAGRAPH_BREAK = re.compile(r"\n\s*\n")


def _units(text: str, max_len: int) -> List[Tuple[str, bool]]:
    """Splits text into (sentence, starts_new_paragraph) units, none longer than max_len."""
    units: List[Tuple[str, bool]] = []
    for paragraph in _PARAGRAPH_BREAK.split(text.replace("\r", "")):
        # PDF extraction hard-wraps lines, so a single newline is just a space.
        paragraph = re.sub(r"\s+", " ", paragraph).strip()
        if not paragraph:
            continue

        first = True
        for sentence in _SENTENCE_END.split(paragraph):
            # A "sentence" with no punctuation at all (tables, lists) can be huge:
            # fall back to cutting it at word boundaries.
            while len(sentence) > max_len:
                cut = sentence.rfind(" ", 0, max_len)
                cut = cut if cut > 0 else max_len
                units.append((sentence[:cut].strip(), first))
                sentence = sentence[cut:].strip()
                first = False
            if sentence:
                units.append((sentence, first))
                first = False
    return units


def _join(units: List[Tuple[str, bool]]) -> str:
    text = ""
    for index, (sentence, new_paragraph) in enumerate(units):
        if index:
            text += "\n\n" if new_paragraph else " "
        text += sentence
    return text


def split_text_into_chunks(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Packs whole sentences into chunks of at most chunk_size characters.

    Each chunk starts with the last sentences of the previous one (up to
    `overlap` characters) so an idea cut at a boundary still appears whole.
    """
    units = _units(text, chunk_size)
    chunks: List[str] = []
    current: List[Tuple[str, bool]] = []

    for unit in units:
        if current and len(_join(current + [unit])) > chunk_size:
            chunks.append(_join(current))

            carried: List[Tuple[str, bool]] = []
            for previous in reversed(current):
                if len(_join([previous] + carried)) > overlap:
                    break
                carried.insert(0, previous)
            # Carrying must leave room for the new sentence and never repeat the
            # whole chunk, otherwise the loop would make no progress.
            if len(carried) < len(current) and len(_join(carried + [unit])) <= chunk_size:
                current = carried
            else:
                current = []

        current.append(unit)

    if current:
        chunks.append(_join(current))

    return [chunk for chunk in chunks if len(chunk) >= MIN_CHUNK_CHARS]


def split_pages_into_chunks(
    pages: List[str], chunk_size: int = 1000, overlap: int = 200
) -> List[Tuple[int, str]]:
    """Chunks each page on its own and returns (page_number, chunk), pages from 1.

    A chunk never crosses a page break, so its page number is exact; the cost
    is that a sentence spanning two pages is cut at the break.
    """
    result: List[Tuple[int, str]] = []
    for number, text in enumerate(pages, start=1):
        for chunk in split_text_into_chunks(text, chunk_size, overlap):
            result.append((number, chunk))
    return result
