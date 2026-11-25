---
user: Charles Lien
task: Log the request host in nginx's access log now, as its own PR against main, so the legacy-host traffic ALL-2152 waits on can be measured before PR #1009 merges.
---

# Requirements

1. The app hosts' nginx access logging records each request's host, so requests to `worldalliance.org`, `staging.worldalliance.org` and their `www.` names can be told apart from requests to the thealliance.org names. (agent-proposed, user-approved)
2. It ships as its own PR against `main`, ahead of PR #1009 (ALL-2152), which merges only once these logs show legacy `/api`, `/events` and `/socket.io` traffic near zero for 14 days. (user-originated)
3. The host's package-owned files, `/etc/nginx/nginx.conf` and `/etc/logrotate.d/nginx`, stay as the package ships them; the change lives in the repo's deployed vhost file. (agent-proposed, user-approved)
