from flask import Flask, jsonify
from flask_cors import CORS

from .config import Config


def create_app(config_overrides: dict | None = None) -> Flask:
    """Build the Flask app. Tests pass config_overrides (e.g. a temp upload folder)."""
    app = Flask(__name__)
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)

    CORS(app, resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGIN"]}})

    from .routes.health import bp as health_bp
    from .routes.sessions import bp as sessions_bp
    from .routes.marking import bp as marking_bp

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(sessions_bp, url_prefix="/api")
    app.register_blueprint(marking_bp, url_prefix="/api")

    @app.errorhandler(413)
    def too_large(_err):
        limit_mb = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        return jsonify(error=f"Upload too large (max {limit_mb} MB in total)."), 413

    # Voice: ElevenLabs speech in/out (all code in app/voice/)
    from .voice import bp as voice_bp

    app.register_blueprint(voice_bp, url_prefix="/api/voice")

    return app
