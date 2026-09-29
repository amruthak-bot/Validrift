#!/usr/bin/env python3
"""Push local commit cc408ec to amruthak-bot/Validrift via the Git Data API.
Uses the stored custom.github credential through the authd surrogate exchange.
Only sends hsurr:* values to api.github.com. Never prints the raw credential.
"""
import json
import subprocess
import sys
import urllib.request
import urllib.error

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response, read_response_body

OWNER = "amruthak-bot"
REPO = "Validrift"
API = "https://api.github.com/repos/%s/%s" % (OWNER, REPO)
ALLOWED = ["api.github.com"]
WORKDIR = "/home/hatch/workspace/vrepo"


def api(method, path, data=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(
        API + path, method=method, data=body,
        headers={"Accept": "application/vnd.github+json",
                 "User-Agent": "validrift-push",
                 "Content-Type": "application/json"})
    add_surrogate_to_request(req, "custom.github", allowed_hosts=ALLOWED)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return read_json_response(r)
    except urllib.error.HTTPError as e:
        raise SystemExit("GitHub API %s %s -> %s %s" % (method, path, e.code, read_response_body(e)[:400]))


def git(*args):
    return subprocess.run(["git", "-C", WORKDIR] + list(args),
                          capture_output=True, text=True, check=True).stdout.strip()


def main():
    ref = api("GET", "/git/refs/heads/main")
    remote_sha = ref["object"]["sha"]
    print("remote HEAD:", remote_sha[:8])
    local_sha = git("rev-parse", "HEAD")
    local_parent = git("rev-parse", "HEAD~1")
    print("local HEAD:", local_sha[:8], "parent:", local_parent[:8])
    if remote_sha != local_parent:
        # Remote may be a Data-API recreation of the local parent (same tree, new SHA).
        remote_tree = api("GET", "/git/commits/" + remote_sha)["tree"]["sha"]
        local_tree = git("rev-parse", local_parent + "^{tree}")
        if remote_tree != local_tree:
            raise SystemExit("remote HEAD diverged from local parent; refusing to push")
        print("remote is content-identical recreation of local parent; proceeding")
    remote_commit = api("GET", "/git/commits/" + remote_sha)
    base_tree = remote_commit["tree"]["sha"]
    msg = git("log", "-1", "--format=%B", local_sha)
    diff = git("diff", "--name-status", local_parent, local_sha)
    entries = []
    for line in diff.splitlines():
        status, path = line.split("\t", 1)
        if status == "D":
            entries.append({"path": path, "mode": "100644", "type": "blob", "sha": None})
            continue
        with open("%s/%s" % (WORKDIR, path), "r", encoding="utf-8") as f:
            content = f.read()
        print("  %s %s (%d bytes)" % (status, path, len(content)))
        entries.append({"path": path, "mode": "100644", "type": "blob", "content": content})
    tree = api("POST", "/git/trees", {"base_tree": base_tree, "tree": entries})
    commit = api("POST", "/git/commits",
                 {"message": msg, "tree": tree["sha"], "parents": [remote_sha]})
    api("PATCH", "/git/refs/heads/main", {"sha": commit["sha"]})
    print("PUSH OK: main ->", commit["sha"][:8])


if __name__ == "__main__":
    main()
