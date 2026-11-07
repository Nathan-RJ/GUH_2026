"""Where the AI plugs in.

Right now these return placeholder text so the whole app works without
an API key. To add a real AI, replace the bodies of these two functions:
`session` holds the prompt, the attachments (files are saved in
uploads/<session id>/) and the full message history.
"""


def opening_message(session: dict) -> str:
    """The first message shown when a session starts."""
    files = session["attachments"]
    file_part = f" and {len(files)} attachment(s)" if files else ""
    return (
        f"Session started with your prompt{file_part}. "
        "(Placeholder reply: the AI isn't connected yet.)"
    )


def reply(session: dict, user_text: str) -> str:
    """Reply to the user's latest message."""
    return f"(Placeholder reply) You said: {user_text}"
