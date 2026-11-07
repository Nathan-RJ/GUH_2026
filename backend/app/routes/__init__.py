# app/routes/__init__.py
# ------------------------------------------------------------------
# Collects every blueprint so create_app() can register them in one go.
# Each file in this folder = one area of the API.
# Routes should stay THIN: read the request, call a service, return JSON.
# ------------------------------------------------------------------
