# app/__init__.py
# ------------------------------------------------------------------
# The "app factory": create_app() builds and returns the Flask app.
#
# - Loads settings from config.py (which reads .env)
# - Enables CORS so the Lovable frontend can call the API
# - Sets up the database (models/)
# - Registers every blueprint in routes/ under the /api prefix
# ------------------------------------------------------------------
