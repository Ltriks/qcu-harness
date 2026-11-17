#!/bin/sh
set -eu
if ! id qcu-diagnostics >/dev/null 2>&1; then useradd --system --no-create-home --shell /sbin/nologin qcu-diagnostics; fi
install -d -m 755 /opt/qcu-diagnostics /etc/qcu-diagnostics /var/lib/qcu-diagnostics /var/lib/qcu-diagnostics/acme /var/lib/qcu-diagnostics/proxy /var/lib/qcu-diagnostics/proxy/logs /var/log/qcu-diagnostics
install -d -o qcu-diagnostics -g qcu-diagnostics -m 700 /var/lib/qcu-diagnostics/data
install -m 644 server.py /opt/qcu-diagnostics/server.py
install -m 644 qcu-diagnostics.service qcu-diagnostics-proxy.service /etc/systemd/system/
if ! test -f /etc/qcu-diagnostics/nginx.conf; then install -m 644 nginx-http.conf /etc/qcu-diagnostics/nginx.conf; fi
systemctl daemon-reload
systemctl enable --now qcu-diagnostics.service qcu-diagnostics-proxy.service
curl --fail --silent --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:18768/health
