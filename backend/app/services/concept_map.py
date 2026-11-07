# app/services/concept_map.py
# ------------------------------------------------------------------
# Builds the module's CONCEPT MAP (the hidden answer key).
#
# - build_concept_map(module)   uses the LLM to pull topics -> concepts
#                               (and the links between them) out of the
#                               content + rubric
# - Stores Topic and Concept rows in the database
# - The frontend's live "brain map" is drawn from this structure
# ------------------------------------------------------------------
