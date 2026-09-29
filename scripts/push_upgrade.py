#!/usr/bin/env python3
"""Push local HEAD to amruthak-bot/Validrift main via the Git Data API.

Builds the remote tree update by diffing the remote tree against the LOCAL
HEAD TREE (via the API + git ls-tree), reading file contents from git objects
(`git show HEAD:path`) so workdir state can never leak in. After creating the
new tree, verifies its SHA equals the local HEAD tree SHA before moving the
`main` ref. Only sends hsurr:* surrogate values to api.github.com; never
prints the raw credential.
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
        with urllib.request.urlopen(req, timeout=120) as r:
            return read_json_response(r)
    except urllib.error.HTTPError as e:
        raise SystemExit("GitHub API %s %s -> %s %s" % (method, path, e.code, read_response_body(e)[:400]))


def git(*args):
    return subprocess.run(["git", "-C", WORKDIR] + list(args),
                          capture_output=True, text=True, check=True).stdout


def main():
    if git("status", "--porcelain").strip():
        raise SystemExit("workdir dirty; commit first")
    local_sha = git("rev-parse", "HEAD").strip()
    local_tree = git("rev-parse", local_sha + "^{tree}").strip()
    msg = git("log", "-1", "--format=%B", local_sha)
    print("local HEAD:", local_sha[:8], "tree:", local_tree[:8])

    ref = api("GET", "/git/refs/heads/main")
    remote_sha = ref["object"]["sha"]
    remote_tree = api("GET", "/git/commits/" + remote_sha)["tree"]["sha"]
    print("remote HEAD:", remote_sha[:8], "tree:", remote_tree[:8])

    remote_blobs = {}
    rtree = api("GET", "/git/trees/" + remote_tree + "?recursive=1")
    for e in rtree.get("tree", []):
        if e["type"] == "blob":
            remote_blobs[e["path"]] = e["sha"]

    local_blobs = {}
    for line in git("ls-tree", "-r", local_sha).splitlines():
        # "100644 blob <sha>\t<path>"
        meta, path = line.split("\t", 1)
        mode, _typ, sha = meta.split(" ")
        local_blobs[path] = (mode, sha)

    entries = []
    for path, (mode, sha) in sorted(local_blobs.items()):
        if remote_blobs.get(path) == sha:
            continue  # unchanged; base_tree covers it
        content = git("show", "%s:%s" % (local_sha, path))
        entries.append({"path": path, "mode": mode, "type": "blob", "content": content})
        print("  upsert %s (%d bytes)" % (path, len(content)))
    for path in sorted(set(remote_blobs) - set(local_blobs)):
        entries.append({"path": path, "mode": "100644", "type": "blob", "sha": None})
        print("  delete %s" % path)

    tree = api("POST", "/git/trees", {"base_tree": remote_tree, "tree": entries})
    if tree["sha"] != local_tree:
        raise SystemExit("created tree %s != local HEAD tree %s; NOT moving ref"
                         % (tree["sha"][:8], local_tree[:8]))
    print("created tree matches local HEAD tree")
    commit = api("POST", "/git/commits",
                 {"message": msg, "tree": tree["sha"], "parents": [remote_sha]})
    api("PATCH", "/git/refs/heads/main", {"sha": commit["sha"]})
    print("PUSH OK: main ->", commit["sha"][:8])


if __name__ == "__main__":
    main()
