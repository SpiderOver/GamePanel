"""Asynchronous UI bridge to the restricted game-host mods command."""
import json
import base64
import os
import re
import tempfile
import threading
import time
import uuid
from pathlib import Path
from flask import jsonify, request


def register(app, ssh, local_profile, app_root):
    lock = threading.Lock()
    jobs = {}
    key_file = Path(app_root) / "data" / "curseforge-api-key"
    icon_dir = Path(app_root) / "static" / "mod-icons"
    icon_dir.mkdir(parents=True, exist_ok=True)
    allowed = {"context", "list", "identify", "search", "versions", "plan", "install", "toggle", "remove"}

    def key():
        env = os.environ.get("CURSEFORGE_API_KEY", "").strip()
        if env:
            return env
        try:
            return key_file.read_text().strip()
        except OSError:
            return ""

    def configured():
        return bool(key())

    def write_key(value):
        key_file.parent.mkdir(parents=True, exist_ok=True)
        fd, path = tempfile.mkstemp(prefix=".curseforge-", dir=key_file.parent)
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, "w") as stream:
                stream.write(value + "\n")
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(path, key_file)
        finally:
            if os.path.exists(path):
                os.unlink(path)

    def worker(job_id, payload, new_key=None):
        try:
            payload["api_key"] = key() if new_key is None else new_key
            if payload.get("action") in {"list", "identify"}:
                payload["known_icons"] = [
                    p.name
                    for p in icon_dir.iterdir()
                    if re.fullmatch(r"[a-f0-9]{32}\.(?:png|jpg)", p.name)
                ][:128]

            process = ssh(
                "mods-manage",
                timeout=1200,
                input_text=json.dumps(payload, ensure_ascii=False),
            )
            if process.returncode:
                raise RuntimeError(
                    (
                        process.stderr.strip()
                        or process.stdout.strip()
                        or "Failed to query the game host."
                    )[-1500:]
                )

            result = json.loads(process.stdout)
            for entry in result.get("entries", []):
                url = entry.get("icon_url", "")
                token = entry.get("icon_token", "")
                if url.startswith("data:image/") and re.fullmatch(r"[a-f0-9]{32}\.(?:png|jpg)", token):
                    raw = base64.b64decode(url.split(",", 1)[1], validate=True)
                    if len(raw) <= 256 * 1024 and (
                        raw.startswith(b"\x89PNG\r\n\x1a\n") or raw[:3] == b"\xff\xd8\xff"
                    ):
                        destination = icon_dir / token
                        if not destination.exists():
                            destination.write_bytes(raw)
                        entry["icon_url"] = "/static/mod-icons/" + token

            if new_key is not None:
                write_key(new_key)
                result = {"ok": True, "api_configured": True}

            with lock:
                jobs[job_id].update(
                    running=False,
                    ok=True,
                    result=result,
                    finished=time.time(),
                )
        except Exception as error:
            message = str(error)
            # Defensive sanitization if any transport ever includes the key.
            for secret in [payload.get("api_key", ""), new_key]:
                if secret:
                    message = message.replace(secret, "[key omitted]")
            with lock:
                jobs[job_id].update(
                    running=False,
                    ok=False,
                    error=message[:1500],
                    finished=time.time(),
                )
        finally:
            payload.pop("api_key", None)

    def start(profile_id, payload, new_key=None):
        with lock:
            for job_id, job in list(jobs.items()):
                if not job["running"] and time.time() - job.get("finished", job["started"]) > 1800:
                    del jobs[job_id]

            existing = next(
                (
                    x
                    for x in jobs.values()
                    if x["profile"] == profile_id and x["running"]
                ),
                None,
            )
            if existing:
                return jsonify(
                    error="A mod operation for this profile is already running.",
                    job_id=existing["id"],
                ), 409

            if sum(x["running"] for x in jobs.values()) >= 4:
                return jsonify(error="Too many operations are currently running."), 429

            job_id = uuid.uuid4().hex
            jobs[job_id] = {
                "id": job_id,
                "profile": profile_id,
                "action": payload["action"],
                "running": True,
                "ok": None,
                "started": time.time(),
            }

        payload["profile"] = profile_id
        threading.Thread(
            target=worker,
            args=(job_id, payload, new_key),
            daemon=True,
            name="mods-" + job_id[:8],
        ).start()
        return jsonify(job_id=job_id, running=True), 202

    def validate(profile_id):
        return bool(re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,99}", profile_id))

    @app.route("/api/profile/<profile_id>/mods", methods=["POST"])
    def api_mods_action(profile_id):
        if not validate(profile_id):
            return jsonify(error="Invalid profile."), 400

        data = request.get_json(silent=True)
        if not isinstance(data, dict) or data.get("action") not in allowed:
            return jsonify(error="Invalid mod action."), 400
        if len(json.dumps(data)) > 8192:
            return jsonify(error="Request too large."), 413

        fields = {
            "action",
            "query",
            "sort",
            "index",
            "channel",
            "project_id",
            "file_id",
            "filename",
            "enabled",
            "max_release_type",
        }
        payload = {k: v for k, v in data.items() if k in fields}
        return start(profile_id, payload)

    @app.route("/api/profile/<profile_id>/mods/jobs/<job_id>")
    def api_mods_job(profile_id, job_id):
        with lock:
            job = jobs.get(job_id)
            if not job or job["profile"] != profile_id:
                return jsonify(error="Operation not found."), 404
            return jsonify(dict(job))

    @app.route("/api/mods/integration", methods=["GET", "POST"])
    def api_mods_integration():
        if request.method == "GET":
            return jsonify(api_configured=configured())

        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(error="Invalid request."), 400

        profile_id = str(data.get("profile_id", ""))
        value = str(data.get("api_key", "")).strip()
        if (
            not validate(profile_id)
            or not 10 <= len(value) <= 512
            or any(ord(c) < 32 for c in value)
        ):
            return jsonify(error="Provide a valid CurseForge API key."), 400

        return start(
            profile_id,
            {"action": "validate-key"},
            new_key=value,
        )
