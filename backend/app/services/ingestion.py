# app/services/ingestion.py
# ------------------------------------------------------------------
# Turns uploaded lecturer files into plain text the AI can use.
#
# - extract_text(file)       PDF / PPTX / DOCX / TXT -> text
# - chunk_text(text)         split long docs into pieces the LLM can handle
# - Saves the extracted text against the Module in the database
# ------------------------------------------------------------------
