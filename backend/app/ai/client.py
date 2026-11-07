# app/ai/client.py
# ------------------------------------------------------------------
# A thin wrapper around the LLM API (e.g. the Anthropic or OpenAI SDK).
#
# - chat(system, messages, model)        normal text reply
# - chat_json(system, messages, schema)  reply forced into JSON
#                                        (used by the judge and exam marking)
# - Handles the API key, retries, timeouts and errors in ONE place,
#   so switching provider means editing only this file.
# ------------------------------------------------------------------
