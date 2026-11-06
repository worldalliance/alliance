# Evidence

Gathered 2026-11-06 over EC2 Instance Connect, read-only until the cleanup below. Host IPs and instance ids are `[redacted]`.

## CI

Deploy on `main` failed at `build-react-app` → "Upload React Build to EC2" for #918, #920 and #921, after #916 deployed. `deploy.yaml` did not change between #916 and the failures. Log:

```
drone-scp error:  error copy file to dest: [redacted], error message: Process exited with status 1
```

## Staging host (30G root volume)

```
/dev/nvme0n1p1   30G   30G   16K 100% /
/dev/nvme0n1p1 1052928 1052882    46  100% /     (inodes)
11G   ~/.bun/install          (4650 cache entries)
6.8G  ~/output/build          (client/assets: 127940 files, oldest 2025-06-04)
2.3G  ~/.cache/yarn
2.1G  ~/admin-app             (30958 files)
705M  ~/.pm2/logs
```

## Production host (30G root volume)

```
/dev/nvme0n1p1   30G   29G  949M  97% /
8.1G  ~/.bun/install
3.0G  ~/output/build
2.4G  ~/.cache/yarn
724M  ~/.pm2/logs             (client-ssr-error.log 376M)
1.8G  journald
```

## One-off cleanup (user-approved)

On both hosts: `bun pm cache rm`, `find ~/output/build -type f -mtime +7 -delete`, `rm -rf ~/.cache/yarn`; on staging also a leftover partial upload in `~`. Afterwards staging was at 45% (17G free) and production at 61% (12G free), with `client-ssr` and `nest-app` online.

## unzip timestamps

The commit reviewer reproduced with UnZip 6.00 (the version on both hosts) that `unzip -o` restores the zip's stored modification time, and `unzip -o -DD` sets the extraction time instead.
