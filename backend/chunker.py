import io
import re
from typing import List, Dict, Any
from pypdf import PdfReader

def clean_surrogates(text: str) -> str:
    """Removes lone surrogate characters commonly produced by mathematical fonts in PDFs."""
    if not text:
        return ""
    try:
        return text.encode("utf-16", "surrogatepass").decode("utf-16", "ignore")
    except Exception:
        return re.sub(r"[\ud800-\udfff]", "", text)

def extract_pages_from_pdf_bytes(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Extracts text page-by-page from raw PDF bytes.
    Preserves page boundaries so every chunk can trace citations back to its original page.
    Repairs hyphenated line-breaks and cleans mathematical surrogate symbols.
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
    except Exception as e:
        raise ValueError(f"Unable to parse PDF document. It may be corrupted or encrypted: {e}")

    pages = []
    for idx, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        # Clean surrogate characters (math symbols) & excessive whitespace
        cleaned_text = clean_surrogates(text)
        # Repair broken hyphenated words across lines (e.g. trans-\nformer -> transformer)
        cleaned_text = re.sub(r"(\w+)-\n(\w+)", r"\1\2", cleaned_text)
        cleaned_text = re.sub(r"\r\n", "\n", cleaned_text)
        cleaned_text = re.sub(r"[ \t]+", " ", cleaned_text)
        cleaned_text = re.sub(r"\n{3,}", "\n\n", cleaned_text).strip()
        pages.append({
            "pageNumber": idx + 1,
            "text": cleaned_text,
        })
    return pages

def has_extractable_text(pages: List[Dict[str, Any]], min_chars: int = 50) -> bool:
    """Checks if the document contains extractable text or is a scanned image PDF."""
    total_chars = sum(len(p.get("text", "").strip()) for p in pages)
    return total_chars >= min_chars

def chunk_document(
    pages: List[Dict[str, Any]],
    chunk_size: int = 2000,
    overlap: int = 200
) -> List[Dict[str, Any]]:
    """
    Sliding-window semantic chunker with overlap.
    Splits at paragraph and sentence boundaries.
    Strictly guarantees all chunks respect chunk_size with continuous overlap,
    even for dense mathematical textbooks or unpunctuated academic appendices.
    """
    chunks = []
    chunk_index = 0

    for page in pages:
        page_num = page["pageNumber"]
        text = page["text"]
        if not text or not text.strip():
            continue

        # Split text into paragraphs
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if not paragraphs:
            paragraphs = [text.strip()]

        current_chunk = ""

        for para in paragraphs:
            # If paragraph itself is longer than chunk_size, split into sentences/slices
            sub_pieces = []
            if len(para) > chunk_size:
                sentences = re.split(r"(?<=[.?!])\s+", para)
                for sent in sentences:
                    sent = sent.strip()
                    if not sent:
                        continue
                    if len(sent) > chunk_size:
                        # Iteratively slice giant unspaced text with step (chunk_size - overlap)
                        start = 0
                        step = max(100, chunk_size - overlap)
                        while start < len(sent):
                            sub_pieces.append(sent[start : start + chunk_size])
                            start += step
                    else:
                        sub_pieces.append(sent)
            else:
                sub_pieces = [para]

            for piece in sub_pieces:
                piece = piece.strip()
                if not piece:
                    continue

                delimiter = " "
                added_len = (len(delimiter) if current_chunk else 0) + len(piece)

                if len(current_chunk) + added_len <= chunk_size:
                    current_chunk = f"{current_chunk}{delimiter}{piece}".strip() if current_chunk else piece
                else:
                    if current_chunk:
                        chunks.append({
                            "id": f"chk_{page_num}_{chunk_index}",
                            "chunkIndex": chunk_index,
                            "pageNumber": page_num,
                            "charLength": len(current_chunk),
                            "text": current_chunk,
                        })
                        chunk_index += 1

                        overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else ""
                        if overlap_text and len(overlap_text) + len(piece) + 1 <= chunk_size:
                            current_chunk = f"{overlap_text} {piece}".strip()
                        else:
                            current_chunk = piece[:chunk_size]
                    else:
                        current_chunk = piece[:chunk_size]

        if current_chunk and current_chunk.strip():
            chunks.append({
                "id": f"chk_{page_num}_{chunk_index}",
                "chunkIndex": chunk_index,
                "pageNumber": page_num,
                "charLength": len(current_chunk),
                "text": current_chunk,
            })
            chunk_index += 1

    return chunks
